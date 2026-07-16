# Weapon System — Run Loadout, Cards, and Modules

> 狀態：本文記錄已確認的武器、單局裝備、升級卡與 Module Slot 產品／工程契約。首三把武器身分、Damage Spread、Projectile Count、Range、XP 曲線、XP 掉落物呈現、集中戰場 visual theme、怪物暗色基礎 palette／發亮階級分離，以及切片 1～10 的既有核心功能已實作。集中 theme 已改用 `#RRGGBB` authoring strings，並在 content preparation 一次轉換成 numeric tint。Damage Spread 跟隨來源 `PLAYER_ATTACK_VISUAL_ROLE` accent 色系，以及 directional topology-frontier、逐 Cell pulse、抵達時傷害 commit 的契約亦已實作；舊端點連線已移除。永久解鎖條件、卡片權重與後期內容仍待 content tuning。

本文是武器系統工作的詳細入口。跨系統的產品方向以 [`spec.md`](../../spec.md) 為準，依賴方向、Runtime 權威與 Glyph 傷害規則以 [`AGENTS.md`](../../AGENTS.md) 為準。若修改武器、升級、裝備欄、Module、卡片抽選或相關 UI，必須同時閱讀這三份文件。若工作涉及玩家生命、護盾、生存 Module、武器統計或死亡結算，還必須閱讀 [`player-survival.md`](player-survival.md)。

## 1. 核心目標

武器系統必須支持以下 Build 循環：

1. 玩家在一局開始前，從已永久解鎖的武器中選擇一把初始武器。
2. 玩家升級時，從三張混合卡片中選擇一張；卡片可能是新武器，也可能是通用 Module。
3. 新武器擴充或替換本局裝備；Module 則投資到指定武器的 Module Slot。
4. 相同 Module 再次投資會在原 Slot 升階；不同 Module 可以覆蓋既有 Slot，使後期 Build 仍能調整方向。
5. 每次投資都必須改變武器或玩家生存的明確能力軸或策略；武器戰鬥類 Module 仍須保留該武器自己的 TargetStrategy、AttackPattern、DamageShape 與 DestructionProfile 身分。

不要把此系統實作成全域的 `Damage +10%` 清單，也不要讓 Module 直接修改 Enemy／Boss Entity HP。所有傷害仍必須經過 Glyph Cell、Impact Cells、Damage Targets 與 Material 規則。

## 2. 名詞與所有權

### Permanent Weapon Unlock

- 跨局的永久進度。
- 新武器在一場遊戲結束後，由主選單／Meta Progression 流程解鎖。
- 永久解鎖資料由 persistence／menu 層管理，不是單局 `WorldState` 可以寫入的狀態。
- 一局開始時，GameHost 將已驗證、不可變的 unlocked weapon definition IDs 傳給 Runtime。

### Run Weapon Acquisition

- 僅存在當前 run 的武器取得。
- 升級三選一可以出現已永久解鎖、但本局尚未裝備的武器卡。
- 取得或替換武器不會改變永久解鎖資料。

### Weapon Definition

- LOADING 階段驗證並準備的 immutable content。
- 定義武器 ID、UI metadata、Module Slot 數量、基礎 combat profile，以及使用的 TargetStrategy、AttackPattern、DamageShape、DestructionProfile、tracking profile 與 semantic attack-presentation role IDs。
- Presentation role 由集中 Battlefield Visual Theme 解析；Weapon Definition 不保存或複製 authoring color、prepared numeric tint、alpha 或亮度值。
- 不保存 cooldown、已安裝 Module、目前 Rank 或其他單局 mutable state。

### Weapon Instance

- Runtime 擁有的單局權威武器實例。
- 具有 stable instance ID、weapon definition ID、裝備位置、獨立 cooldown／attack sequence、固定 Module Slots 與 derived profile revision。
- UI 與 command 必須使用 weapon instance ID；不能只用 definition ID 代表一把已裝備武器。

### Module Definition

- Immutable、可跨武器使用的通用升級 content。
- 定義 stable ID、UI metadata、各 Rank 的明確效果、最大 Rank，以及必要的 effect／strategy-change contracts。
- 首版每個 Module 固定佔一個 Slot。

### Module Slot

- Weapon Instance 內有順序的固定位置。
- 首版所有武器固定具有 `4` 個 Module Slots；數值仍由 Weapon Definition 明確保存並在 content preparation 驗證，Runtime／UI 不得各自重複常數。
- Slot 為空，或保存一個 module definition ID 與目前 Rank。
- Slot index 在武器存續期間保持穩定，供 UI 預覽與原子 command 使用。

### Upgrade Offer

- 一次升級事件產生的三張 immutable、UI-sized choice references。
- 具有 stable offer ID；任何選擇 command 都必須攜帶該 ID，讓 Runtime 拒絕過期、重送或雙擊 command。

## 3. 開局與永久解鎖

- `READY` 階段提供已永久解鎖武器的 UI summaries；fixed simulation 尚未開始。
- 玩家必須選擇且只能選擇一把合法的初始武器，Runtime 驗證後才建立本局 Weapon Instance 並進入 `RUNNING`。
- 未解鎖、未知或過期的 weapon definition ID 必須被拒絕，不得以 fallback 武器靜默開局。
- 本局使用的 unlocked weapon set 必須在 run 開始時凍結。主選單或 persistence 狀態後續改變，不得在同一 run 中途改寫卡池。
- 永久解鎖的條件、結算獎勵與 save migration 不屬於本文件目前的單局實作範圍；未確認前不得在 weapon system 中自行發明。
- Persistence 尚未接入前，開發版 prototype unlock snapshot 包含 assisted `o`、噴火槍與環繞能量球，使玩家無論選哪一把開局，第一次升級都仍有 eligible weapon。這只是可替換的開發預設，不是永久解鎖條件。

## 4. 本局裝備欄

- 首版 `maximumEquippedWeapons` 的 validated run/content default 為 `3`；它不是可以散落在系統與 UI 中的 magic number。
- 一局開始時恰好裝備一把初始武器。
- 首版同一個 weapon definition 不得同時存在多個已裝備 instances；未來若允許重複，仍必須以不同 instance IDs 分開管理。
- 每把武器有獨立 cooldown 與 Runtime attack state。不得保留一個全域 cooldown 代表全部武器。
- Weapon System 以穩定裝備順序更新 instances，讓相同 seed 與相同輸入得到可重現的 firing order。
- 裝備欄、Module Slots、pending offer 與 replacement decision 都是 Runtime 權威資料；React 只能讀取摘要並送出 command。

## 5. 武器卡取得與替換

玩家在升級三選一選到武器卡時：

1. 若裝備數少於 `maximumEquippedWeapons`，Runtime 建立新的 Weapon Instance，使用下一個空裝備位置，Module Slots 全部為空。
2. 若裝備已滿，遊戲保持完全暫停，UI 顯示目前裝備並要求玩家指定要替換的 Weapon Instance。
3. 在最後提交前，玩家可以返回原本三張卡片；只瀏覽武器或 replacement preview 不消耗 offer。
4. 有效提交後，新 Weapon Instance 原子取代指定裝備位置；被替換武器的全部 Module Slots、cooldown 與 instance-owned Runtime state 一起消失。
5. 其他 Weapon Instances 的 IDs、Module Slots、Rank、裝備順序與 cooldown 不得改變。

替換不得退款、轉移或重新分配舊武器的 Module。未來若加入「保留部分投資」能力，必須以明確 replacement policy 選取要保留的 Slot state；不得讓一般 replacement 隱性保留效果。

已經生成的獨立 gameplay projectile／attack object 使用生成瞬間的 resolved combat snapshot，武器被替換後仍可自然完成。該 snapshot 必須保留來源 Weapon Instance ID；替換後才命中的在途攻擊仍歸屬舊 Instance，不能轉嫁或繼承到新 Instance。Beam、orbit 或其他必須持續依附 Weapon Instance 的攻擊，則在 owner weapon 被替換時依其明確 lifecycle rule 結束；不得留下查不到 owner 的懸空狀態。死亡結算只列當下裝備 Instance 的詳細歸屬規則見 [`player-survival.md`](player-survival.md)。

## 6. Module Slot 安裝、覆蓋與升階

玩家選到 Module 卡後，先選擇要投資的 Weapon Instance。Runtime 依以下優先順序求出 placement：

1. **相同 Module 已存在且未達最大 Rank**：沿用該 Slot，Rank 增加一階，例如 `Projectile I → Projectile II`。
2. **沒有相同 Module，且存在空 Slot**：首版使用第一個空 Slot，安裝 Rank I。
3. **沒有相同 Module，且所有 Slots 已滿**：保持暫停，要求玩家指定要覆蓋的 Slot；舊 Module 消失，新 Module 以 Rank I 取代它。
4. **相同 Module 已達最大 Rank**：該 Weapon Instance 對這張卡不是合法 target；UI 可以禁用並顯示原因，Runtime 仍必須在 command boundary 重新驗證。

首版同一個 Weapon Instance 不允許兩個 Slots 保存相同 module definition。重複取得同種 Module 的意義是升階，不是佔用第二格。

Module 的「綁定」精確定義如下：

- Module 不能從一把武器搬到另一把。
- Module 不能卸下、退款或放回卡池。
- 玩家可以用另一個 Module 主動覆蓋並摧毀它。
- 覆蓋只改變指定 Slot，不得改動同武器的其他 Slots。
- 同 Module 升階只改變原 Slot 的 Rank，不建立重複 Slot 或額外 investment object。

Module Rank 不是 Player Level 或 Weapon Level；它只描述某個 Slot 內同一 Module 的投資階段。效果應由 content 提供明確、可驗證的 rank table。每一列保存該 Rank 的**完整總效果**，不是從前一 Rank 再疊乘的增量；例如 Attack Speed II 的 `×1.30` 不得解讀成先乘 Rank I 的 `1.15` 再乘 `1.30`。不得把 `I`、`II`、`III` 寫成互不相干、容易漂移的 definitions。

已實作的首批 prototype Modules 最大 Rank 都是 III：

| Module | Rank I | Rank II | Rank III | 效果值語意 |
| --- | ---: | ---: | ---: | --- |
| Attack Speed | `×1.15` | `×1.30` | `×1.50` | 總 attack-rate multiplier；interval 由 base interval 除以此值 |
| Projectile Count | `2` | `3` | `4` | 一次 AttackPattern 的總 emission／stream／ball 數量，不是額外增加量 |
| Damage Spread | `20%` | `20% / 10%` | `20% / 10% / 5%` | 從原始 DamageShape 外緣起算；數列依序是第一、二、三圈承受的 resolved main damage 比例 |
| Range | `×1.15` | `×1.30` | `×1.50` | 武器可到達距離的完整總倍率；依 AttackPattern 編譯成 acquisition／travel、Cone length 或 maximum radial-sweep radius |
| Knockback | `×1.25` | `×1.60` | `×2.00` | 武器 impact／root knockback strength 的總 multiplier |

每個 Damage Spread Rank 的數列已包含該階完整效果；Rank III 不是在 Rank II 之外再疊加另一組第一、二圈傷害。Range III 的 `×1.50` 也代表相對於該武器 base reach 的完整總倍率，不得在 Range II 的 `×1.30` 上再次乘算。Module effect schema 必須允許 discriminated rank payload，例如 spread 的完整 band ratios，不能假設所有 Module 都只有一個 `totalMultiplier`。這些倍率／比例集中在 content，可經 playtest 替換，不是不可改動的產品常數。其他 Module 可以有不同最大 Rank 或非線性 rank table。

### 6.1 未來 Player Survival Modules

生命、最大生命、護盾層數、護盾回復與護盾破裂相關升級，未來仍以 `MODULE` choice 進入相同交易流程：玩家選擇 Weapon Instance、占用其 ordered Module Slot、同類升 Rank，並受覆蓋與武器替換摧毀規則約束。玩家生存效果可以由 Runtime 從目前裝備的 Module Slots 編譯成獨立 survival profile，不得為了沿用武器熱路徑而硬塞進 `ResolvedWeaponProfile`；Module Slots 仍是唯一投資來源。

本里程碑不建立這些 Module definitions、Rank tables、card-pool entries、preview 或 transaction 分支，也不自行決定最大生命／護盾效果被覆蓋或替換時的 current-value 調整規則。已確認範圍與仍待決策項目集中在 [`player-survival.md`](player-survival.md)。

## 7. 混合三選一卡池

- 每次升級提供恰好三張具有不同 choice IDs 的卡片。
- 卡片是 discriminated choices：`WEAPON` 或 `MODULE`。
- 武器卡只能引用本局 frozen unlocked set 中的 definitions。
- 首版武器卡只從尚未裝備的 definitions 中選取。
- Module 卡只在至少一個已裝備 Weapon Instance 能合法接受或覆蓋時進入 eligible pool。
- 同一次 offer 不出現重複的 weapon definition 或 module definition。
- 第一次升級保證至少一張 eligible 武器卡。首版內容／解鎖配置必須確保第一次升級時至少有一把未裝備、已解鎖武器；若資料不滿足，content preparation 或明確 fallback 必須回報問題，不能偷塞未解鎖武器。
- 其餘卡位與後續升級使用 content-defined weights；精確權重尚未確認，不得寫成產品不變量。
- 抽選使用由 run seed 派生的獨立 upgrade RNG stream。敵人生成、AI 或視覺亂數的消耗不得改變同一升級序列。
- 抽選順序與 tie-break 使用 stable content order／stable IDs，確保結果可重現。

若一次取得多個 level-up，Runtime 以 pending count 排隊。完成一個有效投資或武器取得後，若仍有 pending level-up，直接產生下一個 offer 並保持 `PAUSED_UPGRADE`；不得在兩次選擇之間短暫恢復 simulation。

### 7.1 XP 曲線與升級觸發

首版以 `level`、`xpIntoLevel` 與 `pendingUpgradeCount` 表示升級進度。`xpIntoLevel` 是目前等級內已累積的 XP，不是已花費 XP 的 lifetime total。由目前等級 `L` 升到下一級所需 XP 使用以下 validated prototype curve：

```text
L <= 10: xpToNext(L) = 3 + L × (L + 3) / 2
L > 10:  xpToNext(L) = 68 + 12 × (L - 10)
```

`L` 是升級前的目前等級。前十次門檻如下：

| 升級 | 本級所需 XP | 累積 XP |
| --- | ---: | ---: |
| Lv1 → 2 | 5 | 5 |
| Lv2 → 3 | 8 | 13 |
| Lv3 → 4 | 12 | 25 |
| Lv4 → 5 | 17 | 42 |
| Lv5 → 6 | 23 | 65 |
| Lv6 → 7 | 30 | 95 |
| Lv7 → 8 | 38 | 133 |
| Lv8 → 9 | 47 | 180 |
| Lv9 → 10 | 57 | 237 |
| Lv10 → 11 | 68 | 305 |

XP 結算遵守以下規則：

- 首版 Z、BO、BAT 每次合法死亡 reward 都提供 `1 XP`，先用一致獎勵隔離曲線測量；不同普通敵人、Elite 與 Boss 的差異化 reward 之後由 content 明確定義，不得讓 Boss／Elite 意外繼承普通敵人的 fallback `1 XP`。
- 同一 fixed step 撿到的 XP 先累加，再以 `while` 逐級扣除門檻；所有超額 XP 必須保留。
- 每跨過一級就增加一次 `pendingUpgradeCount`。一次跨多級只建立第一個 active offer，其餘選擇排隊，並在前一個 commit 後依更新後的 loadout 重新產生。
- 第一次武器卡保證依 `offerSequence === 0` 判斷，不依 `level === 2`；大額 XP 一次跨多級不得重複觸發首次保證。
- 第一個升級的 playtest 目標是約擊敗五隻普通敵人、開局約 `8–15` 秒。這是節奏驗收目標，不是寫死的時間門檻；若實測偏慢，優先調整 curve content，而不是在系統中加入特例。
- `xpToNext`、門檻表與 reward values 都是 validated content parameters。升級系統只能讀取準備完成的 curve，不得散落重複公式。

### 7.2 XP 掉落物呈現

XP 掉落物的呈現生命週期只提高拾取辨識度，不改變其權威 pickup、reward 或升級結算：

- 剛生成時使用新鮮黃色的短暫狀態，之後平順過渡為長時間停留的暗金色。
- 進入穩定狀態後只做偶發、短促、低 duty-cycle 的提醒閃爍；不得持續呼吸，也不得讓整批 XP 同步閃爍。
- 閃爍 phase 由 stable drop ID 確定性錯開，時間讀取 simulation／gameplay presentation clock；不得消耗 gameplay RNG、讀取 wall clock，或在完整暫停時繼續老化。
- 新生狀態與任何閃爍峰值疊加實際背景後的有效亮度，都必須嚴格低於每一種玩家攻擊核心的比較階級。
- 這項亮度關係由瀏覽器視覺調校確認，不作為 Runtime 拒絕合法 `#RRGGBB` 色碼的條件。
- 色值、alpha、過渡時間、閃爍間隔、峰值與 duty cycle 只存在 `src/game/content/visuals/prototypeCombatVisualTheme.ts`。其中顏色使用 `#RRGGBB` authoring strings，並只在 LOADING 轉換一次；Drop definition、upgrade system、本文與 renderer 不複製這些數值。

## 8. 原子決策流程

React 可以保存「目前預覽哪張卡、哪把武器、哪個 Slot」等暫時 UI state，但在最後提交前不得改寫 Runtime。

Module command 的代表性 payload：

```text
installModule({
  offerId,
  choiceId,
  weaponInstanceId,
  replacedSlotIndex?
})
```

Weapon command 的代表性 payload：

```text
acquireWeapon({
  offerId,
  choiceId,
  replacedWeaponInstanceId?
})
```

具體 API 名稱可以在實作時依 bridge contracts 微調，但語意不可改變：

- command 必須引用目前 active offer。
- choice 必須屬於該 offer，且 kind 必須符合 command。
- target Weapon Instance 必須仍存在並已裝備。
- Module placement、Rank、空 Slot 與 replacement Slot 必須在 Runtime 重新求值。
- 武器替換只在裝備已滿時要求合法 replacement instance。
- 驗證失敗不得消耗 offer、不得部分修改 Slot／loadout、不得恢復 simulation；只發布 recoverable error 或新的 immutable snapshot。
- 驗證成功後，所有變更以單一 transaction commit，然後才消耗 offer 並決定進入下一個 offer 或回到 `RUNNING`。

## 9. 武器內容與衍生 Combat Profile

武器內容必須分離以下責任：

```text
TargetStrategy       nearest, cone, random, chain candidate, manual aim
AttackPattern        single, burst, spread, beam, orbit, chain
DamageShape          point, circle, capsule, line, cone
DamageSpreadProfile  disabled, exterior bands with per-band damage ratios
DestructionProfile   knockback, pierce, explosion, split, erosion
```

武器戰鬥效果的 Module 不直接散落修改 projectile、collision 或 damage system。每個 Weapon Instance 以 definition 加上目前武器戰鬥類 Slot contents 編譯出 `ResolvedWeaponProfile`：

- 只有 Slot 或 Rank 改變時增加 revision 並重新編譯。
- fixed-step firing hot path 讀取 prepared profile，不得每步建立 modifier arrays 或重做 Rank reduction。
- effect 合成順序固定，例如依 Slot index，再依 definition 內的 effect order。
- derived profile 是可丟棄快取；Module Slots 才是投資的權威來源。

每個 damaging attack 仍必須產生 stable attack event ID、明確 DamageShape、Damage Amount、Impact parameters，以及可選的 immutable DamageSpreadProfile。Current Durability 與 Damage Amount 允許有限正小數；不做整數四捨五入，也沒有最低 `1` 點傷害。傷害扣除後限制在零以上，並使用同一個集中數值精度規則把接近零的浮點殘值正規化為零。Projectile spawn 時複製本次攻擊需要的 resolved values；在途 projectile 不得每步回查可能已升階或被替換的 Weapon Instance。

### 9.1 首三把武器與 prototype combat defaults

首版武器身分依 TargetStrategy、AttackPattern、DamageShape 與 DestructionProfile 分離，不得把非 projectile 武器塞入 single-projectile profile 的假欄位：

| 武器 | TargetStrategy | AttackPattern | DamageShape | DestructionProfile |
| --- | --- | --- | --- | --- |
| Assisted `o` | `AIM_ASSISTED` | `SINGLE_PROJECTILE` | `POINT`／`SINGLE` | `MATERIAL_IMPACT` |
| 噴火槍 | `PLAYER_AIM` | `PULSED_CONE` | `CONE`／`AREA` | `MATERIAL_IMPACT` |
| 環繞能量球 | `OWNER_RELATIVE` | `PERSISTENT_ORBIT` | `CIRCLE`／`AREA` | `KNOCKBACK_CONTACT` |

三把武器各自引用 semantic attack-presentation roles，實際色系與 alpha 由集中 Battlefield Visual Theme 決定。Attack event 必須 snapshot 這個 `PlayerAttackVisualRoleId`，使 projectile travel、Cone pulse 或 orbit contact 延後解析 Damage Spread 時仍保留來源色系。直接 Impact feedback 使用怪物自己的 Appearance Profile；Spread Target feedback 使用來源 attack role 的 `accent` tint。所有玩家攻擊核心 role 都高於 XP 新生／閃爍峰值與怪物受擊峰值；Weapon content 與 renderer 不保存另一套固定色值，也不得依武器 ID 寫 spread 顏色分支。

傷害高低比較以「一個 Damage Target 每次有效命中」為單位：assisted `o` 的 `1.0` 高於能量球的 `0.6`，能量球再高於噴火槍的 `0.125`。AREA 武器可以同時選中多個 Damage Targets，因此總傷害與清怪能力不能只用這個單次數值比較。以基礎 `Max Durability = 1` 的 Cell 為例，未加成的 assisted `o` 可一次歸零、能量球需要兩次有效命中、噴火槍需要八次直接 pulse；Current Durability 可以在過程中保留小數。

#### Assisted `o`

- 遠距單體基準武器；保留有限的 assisted correction，錯過或失去原目標後永久轉為 ballistic。
- Prototype base values：`damageAmount = 1.0`、`fireIntervalMs = 220`、`trackingRange = 700`、`projectileSpeed = 620`、`maximumTravelDistance = 1,116`。原本由 `1,800 ms` lifetime 間接形成的同等路徑長度已遷移為明確 distance budget；Runtime 依每步實際 travelled path 扣除，不再讓 lifetime 暗中兼任 Range contract。
- Gameplay projectile 使用小寫 `o`；projectile position、collision、target 與 damage 都由 Runtime 權威持有。
- 若安裝 Range，初次 target acquisition range、對原目標的 lock-maintenance range，以及沿 projectile 實際彎曲路徑消耗的 maximum travel distance 都套用該 Rank 的完整總倍率。Rank I～III 分別解析成 acquisition／lock `805／910／1,050`，以及 maximum travel distance 約 `1,283／1,451／1,674`；projectile speed、DamageShape radius、assisted correction angle 與 steering responsiveness 不變。每顆在途 projectile 使用 emission-time distance snapshot，最後一段部分距離仍必須有一次 collision 機會。
- 若安裝 Damage Spread，外圍距離以 projectile 的本次原始 point／circle impact shape 為起點。
- 無論是否安裝 Damage Spread，直接命中 `HUSK` 時，使用 projectile 碰撞當下經 assisted correction 後的實際 velocity direction，優先選擇該向前射線第一個相交的同 body 存活 Cell；只有射線上已沒有存活 Cell，才 fallback 到 topology distance 最近的 frontier。遠端主傷害不受 spread band 距離限制，也不會因此把擴散轉移過去。Runtime 建立逐 Cell pending transfer，pulse 抵達前目標維持原 Durability／狀態／亮度，抵達時才套用 `1.0` 傷害與目標受擊亮度；不得畫端點連線。

#### 90° 短程噴火槍

- 沿玩家目前的 authoritative aim direction 攻擊，不執行敵人 target selection 或 tracking。
- Prototype base values：`fullAngle = 90°`、`range = 160`、`damageIntervalMs = 250`、`damageAmount = 0.125`、`muzzleDistance = 20`。這是從原本 `0.25` 直接砍半後的新基準值。
- 若安裝 Range，只對從 muzzle origin 起算的 authoritative Cone 軸向長度套用完整總倍率。Rank I～III 的 Cone length 分別為 `184／208／240`，因此從 player root 起算的最遠 reach 是 `204／228／260`；`fullAngle = 90°`、`muzzleDistance = 20`、damage、pulse interval 與 rendering-only particle count 都不變。
- 每次 damage interval 產生一次瞬時 authoritative Cone DamageShape。Broad phase 可以用包覆圓查詢 owner，但 precise hit 必須逐一測試完整 Glyph outline 與 Cone，包括 `HUSK`。
- Cone 是 AREA attack；每個 owner 的 target quota 等於其 distinct Impact Cells 數量，living Impact Cells 優先。每個造成缺額的 Husk Impact Cell 都使用從該 Cone stream 的 muzzle origin 穿過自身的局部射線，優先鑽向該射線第一個存活 Cell；不能讓整個約 `90°` 扇形的所有 Husk 共用平行中心軸。只有一條局部射線已鑽通時，該來源才 fallback 到最近 topology frontier。多來源必須去重，同一 attack event 不能讓同一目標重複受傷。只有實際 Cone 內的 Impact Cells 取得 primary hit flash、粒子與 Material response；遠端目標等各自的逐 Cell pulse 抵達才扣傷害並顯示受擊亮度。
- 一道 Cone stream 的一次 pulse 是一個 attack event。Cone 內的所有幾何取樣、Impact Cells 與 owner queries 都共享同一 event ID，不能讓同一 Cell 因落入多個取樣區而重複吃直接或擴散傷害。Projectile Count 產生的每一道 Cone stream 則各自建立 event；多道 Cone 重疊時，每一道火仍可各造成一次傷害。
- 若安裝 Damage Spread，bands 從**整個 authoritative Cone 的外圍**向外計算，包括其弧形遠端與兩側邊界；不得由每顆 rendering 火星、每個 Cone 取樣點或每個 Impact Cell 各自產生擴散圈。
- `.`、`*` 飛散使用集中設定的 fire-spectrum presentation roles，且仍是 rendering-only presentation；調整其實際色值或把視覺密度降為零時，傷害結果必須完全相同。不得把每顆火星建立成 gameplay projectile。
- 首版「火焰」只代表武器外觀與攻擊形狀，不包含 Fire DoT、燃燒疊加、刷新或元素組合。這些仍等待獨立 Glyph status contract。

#### 環繞能量球

- 能量球核心使用 Printable ASCII `O`。軌道相位、world position、collision radius、damage 與 per-owner re-hit cooldown 都是 Runtime 權威資料；Renderer 不得自行繞著玩家計算 gameplay position。
- Prototype base values：`ballCount = 1`、`orbitRadius = 80`、`damageRadius = 16`、`angularSpeed = 0.9 revolutions/second`、`damageAmount = 0.6`、`rehitCooldownMs = 200`、`rootKnockbackDistance = 20`。`damageRadius` 已由 `14` 保守調高為 `16`，後續仍可依實機手感集中調整。
- `orbitRadius` 是玩家 root 到球心的軌道半徑，`damageRadius` 是以球心為中心的 authoritative Circle 半徑；內圈與外圈不是兩個獨立 content fields。基礎軌道在不計目標 Glyph 自身 collision radius 時形成 `80 - 16 = 64` 到 `80 + 16 = 96` 的球心傷害環帶；精確相交仍須再納入各 Glyph 的 authoritative collision radius。若要同時讓內圈往內、外圈往外增加視覺接觸容錯，應集中調高 `damageRadius`；修改 `orbitRadius` 只會平移整個環帶，不得拿來冒充對稱擴張。
- 若安裝 Range，`orbitRadius = 80` 仍是每顆球 deterministic radial sweep 的最小／基礎半徑，完整總倍率只決定 maximum radius；Rank I～III 的 sweep range 分別為 `80～92`、`80～104`、`80～120`。Range 不放大 Weapon Definition 的 base `damageRadius`，避免把 Range 混成 Attack Area；多球維持等角度分布並使用穩定錯開的 radial phase，不能全部同時移到外圈。
- 每顆球是依附 Weapon Instance 的 persistent attack，不是一般 `ProjectileState`。武器被替換或移除時，所屬球、hit history 與 instance-owned state 一起終止。
- 球的 Circle 與完整 Glyph outline 精確相交；命中後不消失。接觸紀錄以「每顆球 × 每個 creature owner」獨立保存：球新進入某個 owner，或離開後再次進入時，這個新 contact episode 必須立即可命中，不受上一段持續接觸計時限制；只有球與該 owner 連續重疊時，成功命中才以 `200ms` 為最短間隔節流，避免每個 fixed step 都造成傷害。即使 Attack Speed 讓球在 `200ms` 內繞完一圈，離開後重新接觸仍應立即命中。
- Broad／precise sweep 找到 owner 候選本身不得開始或刷新節流；只有 Damage System 確認本次 DamageShape 至少取得一個 Impact Cell 時，才提交該次成功命中並開始 `200ms`。Husk 也是合法 Impact Cell；其直接傷害若建立 pending topology transfer，仍視為這次成功接觸，但遠端目標要等 pulse 抵達才受傷。
- 球與移動中的 creature 必須以雙方 previous-to-current authoritative motion 做 relative swept-circle broad／precise collision，並以實際 contact point 建立本次 Circle DamageShape；不得只測 fixed-step 終點，也不得只掃球而把 owner 當作靜止。Range Rank 改變時保留共同 phase，但 profile-revision rebase 不能被誤判成一條長距離 sweep attack。
- 能量球在程式上是小型 Circle AREA，而不是 SINGLE Point。每個 Husk Impact source 的 traversal direction 使用 previous authoritative ball position 到實際 contact point 的 swept-motion direction，包含 Range 造成的徑向分量；不得拿玩家到球心的向外方向代替。
- 擊退方向仍由玩家 root 指向球心，將整個 creature root 向外推離玩家；它與 traversal direction 是兩個獨立欄位。所有 active outline Glyphs 隨 root 位移。只有實際 Impact Cells 同時取得局部 Material hit response，遠端 pending Damage Targets 不得取得局部位移或 primary hit effect，並在 pulse 抵達時才扣傷害與改變亮度。
- 若安裝 Damage Spread，bands 從這次直接接觸所使用的 authoritative ball Circle 外緣向外計算，不從每個被球碰到的 Cell 再各自產生一圈。擴散本身不複製能量球的 whole-body knockback。
- 主球 `O` 是 authoritative attack 的 render representation；光暈、拖尾與周圍粒子是 rendering-only。暫停時軌道與 gameplay-synchronized presentation time 都不前進。
- 本武器已完成 persistent orbit、每球／owner contact episode、`200ms` 連續接觸節流、成功 Impact Cell 才提交 gate、球／owner relative swept collision、whole-body knockback 與 replacement cleanup，並已加入開發版 unlock snapshot 與卡池。

### 9.1 Directional topology-frontier transfer

這是所有直接攻擊的共同規則，不屬於 Damage Spread Module：

1. DamageShape 內的 living Impact Cells 仍立即受傷；每個造成 quota 缺額的 Husk Impact Cell 則成為一個穩定 source。
2. Source 先依該武器的 authoritative traversal ray 選擇前方第一個存活 Cell。Assisted projectile 使用 contact velocity；orbit 使用實際 swept motion；Cone 使用各自 muzzle-to-impact ray。
3. 只有該 source 的射線上已沒有存活 Cell，才代表此方向已鑽通並 fallback 到 topology distance 最近的 frontier。方向候選永遠優先於更近的側邊候選。
4. Runtime 在命中步只建立 pending transfer，保存 attack identity、source、target、保留傷害、deterministic canonical-topology path 與 Gameplay-time progress；不得先改目標 Durability 或亮度。
5. Source 播放正常 primary hit，後續 path Cells 依序播放較暗 transfer pulse。中間 Cells 不受傷、不取得 Material impulse／primary particles，也不得畫任何跨 Cell 線段。
6. Pulse 抵達目標的 fixed step 才重驗目標、套用保留傷害、刷新目標受擊亮度、記錄實際傷害並允許 Husk／collapse transition。抵達前目標保持原狀；失效目標終止且不自動改打別顆 Cell。
7. 一個 event 內的 source／target／path 選擇與 pending reservation 都使用 stable IDs 去重。完整 Gameplay pause 會凍結 pulse，固定步不得每幀重新執行 topology search。

## 10. 通用 Module 的能力軸

長期通用 Module 能力軸包含：

- Attack Speed：改變 weapon cadence／fire interval，並遵守最小安全間隔。
- Projectile Count：改變一次 AttackPattern 的 emission count；非傳統 projectile 武器也必須定義可讀、非 no-op 的對應語意。
- Damage Spread：在原始 DamageShape 外緣增加按距離衰減的 living-Cell 傷害帶；不放大原始 Shape，也不等同於 targeting range。
- Range：改變 target acquisition／attack travel reach、Cone 軸向長度或 persistent orbit 的最大 radial-sweep radius；不能用一個含糊欄位同時代表所有距離，也不能放大 Damage Spread bands。
- Duration：改變 projectile、beam、orbit、lingering shape 或 status 的明確 lifetime。
- Pierce：改變可存續的 collision／body-hit budget，不得用來繞過每個 body 的 Glyph Damage Target quota。
- Knockback：改變 Impact Cells 收到的 attack impulse，再由 Glyph Material 決定實際位移與恢復。
- Element：選擇 Fire、Ice、Lightning 等明確 Glyph interaction strategy。

「通用」表示每個可裝備武器都必須有明確、可感知且可驗證的效果，不表示所有武器盲目加同一 numeric field。LOADING 必須驗證首版 Module 對首版武器不是 no-op；若某個能力軸尚未定義跨 AttackPattern 語意，就不要把該卡放進 content pool。

首批實際進入 prototype content pool 的 Module 是 Attack Speed、Projectile Count、Damage Spread 與 Knockback，並使用第 6 節的 Rank table。舊 Attack Area prototype 已遷移成 Damage Spread，不再放大三把武器原始 DamageShape：

- Attack Speed：assisted `o` 縮短 firing interval；噴火槍縮短 Cone damage interval；能量球提高 authoritative angular speed，使球更快繞行。`rehitCooldownMs = 200` 只限制同一球／owner 的連續接觸成功命中，不隨 Attack Speed 縮短；離開後再次進入的新 contact episode 仍立即可命中。
- Projectile Count：Rank I～III 的總數依序是 `2`、`3`、`4`。assisted `o` 的相鄰 emission 方向間隔為 `8°`；噴火槍相鄰 Cone stream 的中心方向間隔為 `10°`；能量球在完整 `360°` 軌道上依總球數等距分布。
- Damage Spread：三把武器都使用本節下方的共同空間與 Rank 規則，差別只在它們各自的原始 point／circle、Cone 或 orbit-contact Circle。
- Knockback：放大 Impact Cells 收到的 local impact strength；若武器明確具有 whole-body knockback profile，也同時放大其 authoritative root impulse。Root displacement 與 local Glyph Material response 是兩個分離效果。

Projectile Count 的首三把武器語意與 prototype 數值如下：

- assisted `o`：同一次 volley 只執行一次初始 target query，所有 projectile 共用該初始 target；方向以瞄準軸為中心對稱排列，相鄰方向相差 `8°`。每顆 projectile 仍有自己的 authoritative state、碰撞與 emission-time profile snapshot。
- 噴火槍：Cone streams 以瞄準軸為中心對稱排列，相鄰中心方向相差 `10°`；每道 Cone 都是獨立 attack event，重疊處不互相取消傷害，且每道都有對應 rendering-only emitter summary。
- 能量球：同軌道的 authoritative balls 依 `ballIndex / totalCount × 360°` 等距錯開。Rank 改變時保留共同 base phase，並重新均分所有現存／新增球，不讓新增球固定從世界零角度插入。

Range 的 Rank table、獨立 content definition、首三把武器的 resolved mapping，以及 assisted `o`／噴火槍 Runtime 行為已完成；該 definition 目前刻意不註冊進正式 Module pool。在能量球 radial sweep／swept collision 與 weapon-specific preview 完成前仍不得進入 card pool。Duration、Pierce 與 Element 仍須先定義跨武器、非 no-op 且無隱藏負面效果的語意。尤其不能把 orbit 的固定 radius 直接向外搬來冒充 Range，因為那會永久製造新的近身死角。

### 10.1 Range 的共同規則

Range Rank I～III 保存相對於 Weapon Definition base reach 的完整總倍率 `×1.15／×1.30／×1.50`。Resolver 必須依 discriminated AttackPattern 編譯明確欄位，不得新增一個被所有武器盲目共用的含糊 `rangeMultiplier` hot-path 判斷：

1. Assisted `o`：同時解析 initial acquisition、lock-maintenance 與 maximum path-distance budget。基礎 acquisition／lock 是 `700`，基礎 maximum travel distance 是 `1,116`；各 Rank 的 resolved 結果依第 9.1 節。距離 budget 依實際 travelled path 扣除，speed 與 guidance profile 不變；final partial segment 仍參與 collision，pool reuse 必須完整 reset 剩餘距離。
2. 噴火槍：只解析 authoritative Cone length `160 → 184／208／240`。同一次 emission 的 Damage Event 與 Flame Emitter snapshot 必須取得同一 resolved length；Renderer 只把該 snapshot 視覺化，不能從最遠火星位置反推命中。
3. 能量球：保留 base radius `80` 與 Weapon Definition 的 base contact `damageRadius = 16`，只把 maximum radial-sweep radius 解析為 `92／104／120`。每顆球的 angle 與 radial phase 都由 Runtime 依共同 phase、ball index 與 total count 確定性求出；Attack Speed 可以讓共同 phase 更快前進，但 Range 不改 `rehitCooldownMs` 或 contact Circle 大小。
4. 能量球每步使用球與 owner 雙方 previous-to-current motion 的 relative swept Circle 查詢。Broad phase 包覆完整相對 motion，precise phase 對 authoritative Glyph circles 求實際 contact point；Damage Event、Damage Spread、local Material response 與 outward whole-body knockback 都以該接觸位置／方向解析。Profile revision 可以重新對齊新 sweep range，但不得把 upgrade snap 當成一次穿越整段空間的攻擊。
5. Range 不改任何 Damage Spread Rank 的 `bandWidth` 或 ratios。Assisted `o` 仍從實際 projectile contact Circle 外緣、噴火槍從延長後的完整 Cone 外緣、能量球從本次接觸 Circle 外緣開始 spread；Range 只改原始攻擊可到達的位置／長度。
6. Upgrade choice 可以顯示通用 Rank multiplier，但 weapon target 與 confirm preview 必須由 Runtime 提供實際 before／after summary，例如 `Target 700 → 805 / Travel 1116 → 1283`、`Cone 160 → 184`、`Sweep 80 → 80–92`。React 不得讀 content registry 或自行重算這些數字。
7. Range content 可以在未註冊進正式 offer pool 的狀態下分階段完成 schema 與行為；只有三把確認武器都具備非 no-op mapping、必要 preview 與驗證後，才以同一個可見切片啟用卡片。

### 10.2 Damage Spread 的共同規則

Damage Spread 先完成原始攻擊的 Impact Cells 與直接 Damage Targets，再以同一 attack event 解析外圍擴散：

1. 原始 DamageShape 必須先取得至少一個 Primary Impact Cell；完全落空的 attack event 不觸發 spread。接著以該 event 的**原始完整 DamageShape**為零距離邊界，求每顆候選 Glyph Circle 到 Shape 的最短外部距離；Shape 內或與 Shape 相交者不是 spread-only target。
2. 首版 `spreadBandWidth` 為 `24` world units，由集中、可驗證的 Module content 參數提供。對正距離 `d`，第 `n` 圈為 `(n - 1) × spreadBandWidth < d ≤ n × spreadBandWidth`。`24` 是可調整的 prototype default，不得複製成各武器、敵人物種或系統中的散落常數。
3. Rank I 的 band ratios 為 `[0.20]`；Rank II 為 `[0.20, 0.10]`；Rank III 為 `[0.20, 0.10, 0.05]`。每個比例乘上這次 emission／contact 已解析且已 snapshot 的 main damage。
4. 只選取 `HEALTHY`／`DAMAGED` Cells。`HUSK` 既不承受 spread，也不會把 spread 透過 owner topology 轉移給遠端存活 Cell。未來若明確能力允許 Husk 傳遞 spread，必須另外 opt in 9.1 節的 Area 逐來源方向 policy，行為比照 Cone；目前不得預設啟用。
5. 不限制 owner。所有精確落在 band 內的存活 Cells 都受傷，包括沒有被原始 Shape 命中的其他生命體；若直接命中的 owner 沒有存活 Cell 位於 bands 內，該 owner 只承受原本直接傷害。
6. 以 `(attackEventId, glyphId)` 合併同一 event 的所有候選，最多套用一次最高傷害。直接主傷害與 spread 重疊時主傷害勝出；多圈邊界、broad-phase 重複、Cone 內部取樣或多個 Impact Cells 都不能疊出額外次數。
7. Spread Targets 播放可辨識的擴散受傷回饋，但不自動繼承主要 Impact Cells 的 Material impulse、whole-body knockback 或 topology transfer。直接命中 Husk 所建立的遠端 direct damage 依 9.1 節成為 pending transfer，必須等逐 Cell pulse 抵達才扣傷害並改變目標亮度；它與立即解析、預設不經 Husk 的 spread 是兩套不同語意。
8. Spread feedback 的 tint 從該 attack event 已 snapshot 的 `PlayerAttackVisualRoleId` 查詢集中 theme 的 `playerAttacks[roleId].accent`。Assisted `o` 與 orbit 使用各自能量色系；噴火槍使用 fire-spectrum 橘黃色系。共享 spread-effect 設定只控制 alpha、scale 與 duration，不保存一個固定藍色或其他全武器共用 tint。
9. 只有成功套用大於零的 spread Durability damage 才刷新 feedback。若同一 Glyph 的既有 spread feedback 尚未結束，又依穩定 attack-event 處理順序收到另一個 role 的有效擴散傷害，最新一次成功事件取代 active role 並重新開始 duration。Renderer 只消費 Runtime 提供的 role／prepared tint，不得從 projectile glyph、weapon definition ID 或 emitter 類型反推。

元素 Module 上線前必須先完成其 Glyph 契約：

- Fire：對哪些 Damage Targets 持續降低 Durability，如何計時與疊加。
- Ice：如何改變被影響 Glyph 的 displacement／Material response，而不建立第二套 HP。
- Lightning：如何沿空間或 topology 選擇相鄰 Glyphs，並保持 deterministic ordering。

元素是否互斥、可同時存在或產生組合效果仍待 content 決策；未確認前不建立隱藏覆蓋規則。

## 11. Upgrade UI 與完全暫停

Upgrade UI 是 Canvas 上方的 React DOM overlay，不是 PixiJS scene objects：

- React 負責三張卡片、武器 target、Slot replacement、返回／確認、focus、keyboard navigation、動畫與 responsive layout。
- Runtime 負責 active offer、eligible targets、Rank／placement、loadout mutation、暫停與 command validation。
- PixiJS 只繼續顯示暫停中的戰場 snapshot，不接收卡片點擊，也不決定選擇結果。
- 不使用實驗性的 PixiJS `DOMContainer` 放置這類 viewport-centered UI；它只適合必須跟隨 scene node 的 DOM。

React 可以使用 CSS、SVG 或 Web Animations 呈現文字聚合、staggered entry、3D tilt、neon border、scanline、glitch、code diff 與 Rank compile 等效果。動畫應以 `transform`／`opacity` 為主，避免以 React state 驅動每一幀，並提供 `prefers-reduced-motion` 路徑。

Damage Spread 卡與 target preview 顯示該 Rank 的完整 band ratios，例如 Rank II 顯示 `20% / 10%`；Projectile Count 顯示該 Rank 的總數，例如 Rank II 顯示 `3 emissions`。Range 卡可以列出完整 Rank multiplier，但選擇 target weapon 與確認 transaction 時必須顯示 Runtime-authored、weapon-specific before／after reach，例如 assisted acquisition／travel、Cone length 或 orbit sweep interval。不得把這些效果偽裝成不相干的 multiplier，或由 React 自行推算。這些仍是 UI-sized immutable summaries。

整個決策鏈都維持完全暫停：

```text
choose card
→ choose target weapon
→ optionally choose replacement Slot／weapon
→ validate and commit
→ next queued offer or RUNNING
```

Gameplay time、cooldown、projectile、enemy、damage、drop 與 director 都不得前進。UI animation 使用獨立的 DOM／CSS clock，可以在 gameplay simulation 暫停時繼續播放。

若 upgrade trigger 在 catch-up frame 的第一個 fixed step 發生，GameHost／loop 必須在每個 step boundary 重新檢查 phase，立即中止剩餘 catch-up steps 並清空不應保留的 accumulator。只在整個 RAF 開始前檢查一次 `RUNNING` 不足以保證完全暫停。

阻塞式 overlay 開啟時應清除或忽略已按住的 gameplay input，避免關閉卡片後立刻套用暫停期間累積的移動。

## 12. UiSnapshot 邊界

React 只接收 UI-sized immutable summaries，例如：

- phase、level、`xpIntoLevel`、`xpToNext`、offer ID、pending upgrade count 與 recoverable error；
- 三張 card 的 choice ID、kind、title、description、rank preview；
- 最多三筆 equipped weapon summaries；
- weapon instance ID、名稱／ASCII identity、Module Slot count；
- 各 Slot 的 module title／rank；
- 對目前 choice 的 target eligibility、operation preview 與 disable reason；
- pending weapon replacement summary。

不得傳遞完整 content registries、mutable Weapon Instance、WorldState、projectiles、Glyph arrays 或 Pixi display objects。React 可以依 snapshot 顯示預覽，但 Runtime 必須在最終 command 再次驗證。

## 13. 效能與可重現性

- 武器數量雖然首版最多三把，weapon loop 仍不得在 fixed step 配置暫時 modifier structures。
- 多發 Module 應由一次 AttackPattern 決定 target sharing／distribution，不要讓每顆 projectile 無限制重做昂貴 target query。
- Homing reacquisition 繼續使用 budgeted spatial query；初次 target selection 與大量 emissions 也需要診斷計數。
- Projectile pool 新增 source weapon、pierce、element 或 hit-history 欄位時，reuse 必須完整 reset，不能繼承上一顆 projectile 的狀態。
- 高量噴火 presentation 應以小型 emitter summary／event 驅動 rendering-owned dense pool，不把每顆 `.`／`*` 火星放入 WorldState 或逐顆跨 bridge 傳輸。粒子必須有 per-emitter 與 global budgets；降級品質只減少 presentation density，不降低 Cone DamageShape 精確度。
- 能量球核心作為 authoritative attack 進入 render snapshot；光暈與拖尾留在 rendering-only pool。不得讓 presentation pulse 或 interpolation 回寫 orbit gameplay position。
- Damage Spread 的 broad phase 只查詢原始 Shape 加最大 band width 的包覆範圍，再對候選 Glyph Circle 做精確 shape-distance／band test。不得為每顆火星、Cone sample、Impact Cell 或 owner 重掃所有敵人，也不得在 fixed-step hot path 為每個候選配置暫時 Map／closure。
- 一個 attack event 使用可重用的 damage accumulator／dedup storage，先合併 in-shape primary、spread 與 remote-direct reservation 的最高值；前兩者可以在當步 mutation，遠端 direct 必須建立 pending transfer 並延後至抵達。Topology path 只在命中／排程時求一次，後續 fixed steps 只推進 active transfer 的時間與 path cursor，不得每步重新搜尋 topology。追蹤 spread candidates／precise tests／dedup hits，以及 active transfers、total path Cells、arrival commits、invalid-target cancellations 與 pool misses，避免大型 Slime 或多 Cone 導致隱性平方成本。
- Pending transfer 可以使用 reusable path／state pools，但不得因 presentation budget 或 pool 容量不足而提早套用、遺失或重複權威傷害；降級時只能減少非必要附加粒子，不能省略逐 Cell 順序、目標抵達時序或 arrival validation。
- Attack Speed、Projectile Count、Damage Spread 與 chain effects 上線時，追蹤 active attacks、emissions、target queries、damage requests、pool misses 與 simulation p95。
- Range 上線時另外追蹤 range-expired projectile count、active projectile path-distance budgets、orbit swept-collision candidates 與 precise swept tests。增加 reach 不得用提高 projectile speed 取代，因目前沒有通用 projectile swept collision；也不得讓更遠 Cone／orbit queries 退化成逐攻擊掃描全部敵人。
- 抽選、Slot 合成、Rank 編譯、target tie-break 與 firing order 都必須 deterministic，不得使用 `Math.random()`。
- 不得為了效能降低 Glyph DamageShape 精確度、Husk outline 規則或 Impact Cells／Damage Targets 分離。

## 14. 必要驗證

風險導向的純規則測試至少覆蓋：

- rejects an initial weapon that is unknown or not in the frozen unlock set
- applies the validated XP curve while preserving overflow across multiple level-ups
- transitions XP presentation from fresh to settled without changing pickup or reward state
- staggers occasional XP flashes by stable drop ID and freezes their age while gameplay is paused
- accepts arbitrary valid `#RRGGBB` XP and attack colors without aesthetic luminance rejection
- queues one pending upgrade per crossed level without resuming between offers
- guarantees an eligible weapon card in the first upgrade offer
- produces the same three unique cards from the same upgrade seed and state
- does not let enemy RNG consumption change upgrade offers
- intersects cone boundaries against authoritative Glyph circles, including Husks
- keeps rendering-only flame particles from changing cone damage results
- preserves fractional durability for `0.125` flame damage and normalizes near-zero residue to `HUSK`
- classifies every spread band from the exterior of the original whole DamageShape
- applies Rank I／II／III spread ratios as complete `[20%]`、`[20%, 10%]`、`[20%, 10%, 5%]` effects
- damages every living Glyph Cell in spread bands across owners while excluding Husks
- never topology-transfers spread when no living Cell lies inside the bands
- preserves full direct topology-frontier damage when the primary impact is a Husk, independent of spread distance
- prefers a forward aligned living target over a closer side frontier and falls back only after drilling through
- derives traversal from projectile contact velocity、orbit swept motion 或 each Cone source's muzzle-to-impact ray
- applies at most the highest direct or spread amount once per Glyph and attack event
- deduplicates all geometry samples inside one Cone event while allowing independent Cone streams to overlap
- emits distinct spread feedback without copying primary Material impulse or whole-body knockback
- snapshots each attack's visual role and colors spread feedback from that role's configured accent
- refreshes spread duration and deterministically replaces its role only after a later successful spread hit
- preserves one deterministic source-to-target topology path for every frontier-only direct Damage Target
- pulses the actual path Cells in order below primary-hit emphasis without drawing a transfer line
- keeps the remote target unchanged until arrival, then commits reserved damage and target brightness together
- cancels an invalid arrival target without retargeting or duplicate damage
- compiles Projectile Count Rank I／II／III as total counts `2`、`3`、`4`
- emits one assisted projectile volley from one target query with centered `8°` spacing
- emits independent centered Cone events with `10°` spacing and allows overlap damage
- keeps orbit balls evenly phase-spaced when Projectile Count changes
- compiles Range Rank I／II／III as complete `×1.15／×1.30／×1.50` reach multipliers without compounding prior Ranks
- extends assisted acquisition、lock maintenance 與 maximum travelled path distance without changing projectile speed、radius 或 guidance profile
- lets a projectile's final partial Range segment participate in collision and fully resets its pooled distance state
- extends the authoritative Cone and rendering-only Flame Emitter with one identical resolved length while preserving angle、damage、cadence 與 particle count
- keeps Damage Spread band width／ratios unchanged and starts it from the Range-adjusted primary shape exterior
- sweeps each orbit ball from base radius `80` to the resolved maximum while keeping contact radius `16` and deterministic multi-ball phase offsets
- detects orbit contacts across the complete previous-to-current swept Circle without treating a Range Rank rebase as a long attack
- lets a new orbit contact episode hit immediately while throttling only continuous overlap per ball／owner at `200ms`
- starts or refreshes an orbit re-hit gate only after Damage System confirms at least one Impact Cell
- detects orbit contact from relative ball／owner motion so a moving enemy cannot visually cross the ball without an authoritative hit
- preserves whole-body knockback、replacement cleanup 與 pause behavior after Range is installed
- publishes Runtime-authored weapon-specific Range before／after previews without letting React calculate combat values
- installs a new module into the first empty Slot at Rank I
- upgrades an existing matching module in place without consuming another Slot
- rejects a matching module target that is already at maximum Rank
- replaces exactly the selected full Slot and destroys only its previous module
- never moves or refunds a module between Weapon Instances
- equips a new weapon below the loadout limit with empty Module Slots
- replaces exactly one selected weapon and discards all of that weapon's Modules
- leaves every untouched weapon instance and Slot unchanged after replacement
- rejects stale or replayed offer commands without consuming the active offer
- keeps gameplay paused until the full card／weapon／Slot decision commits
- keeps queued level-ups paused between consecutive offers
- snapshots in-flight attack values so later Module changes do not rewrite them
- preserves Glyph Impact Cell、Damage Target、Husk 與 topology-frontier invariants for every upgraded attack
- keeps orbit phase deterministic, tracks contact episodes per ball／owner, throttles continuous overlap at `200ms`, and clears its balls and hit history with its Weapon Instance

## 15. 首版實作切片

1. **已完成**：將 assisted `o` 準備成 immutable Weapon Definition，建立 World-owned loadout、stable Weapon Instance、獨立 cooldown 與固定 Module Slots。
2. **已完成**：讓 `READY` 以 frozen unlocked summaries 選擇一把合法初始武器，驗證後才開始 run。
3. **已完成**：完整加入第二把實際武器噴火槍、XP curve／overflow／pending count、mixed card offer、dedicated upgrade RNG、第一次升級武器卡保證，以及 domain 到 GameHost 的完全暫停邊界。未完成的能量球未放入卡池。
4. **已完成**：以 Attack Speed、舊 Attack Area prototype、Knockback 證明空格安裝、同類升階、最大 Rank 拒絕、滿格覆蓋、stale offer 拒絕與連續 pending offer 的原子流程；並將 ordered Slots 編譯成 revisioned `ResolvedWeaponProfile`，保留在途 attack 的 emission-time snapshot。Attack Area 在這一步只是用來驗證管線，不再代表目前確認的產品方向。
5. **已完成**：接上武器卡的原子取得交易；未滿上限時建立空 Slots 的新 Weapon Instance，滿裝時要求明確 replacement instance、保留 equipment position、摧毀舊實例投資與 runtime state，且不改動其他武器。替換不清除獨立在途 projectile，其攻擊資料繼續使用生成時 snapshot；instance-attached orbit 則依明確 lifecycle rule 立即終止並清除 hit history。
6. **已完成**：以 Canvas 上方的 React DOM overlay 完成三張卡、武器 target、Module Slot overwrite、weapon replacement、返回／確認與 recoverable error 流程。UI 使用純 preview view-model 組出最終 command，Runtime 仍原子重驗；並加入鍵盤 `1–3`／Tab／Enter／Escape 操作、初始 focus、responsive layout、staggered text aggregation、3D tilt、neon scanline、glitch 與 code-diff compile 動畫，且提供 `prefers-reduced-motion` 路徑。
7. **已完成**：實作 Runtime-owned persistent orbit 能量球、精確 Glyph Circle impact、每球／owner contact episode、新接觸立即命中、`200ms` 連續重疊節流、成功 Impact Cell 才提交 gate、球／owner relative swept motion、whole-body outward knockback、Module 對應語意、render snapshot 與 replacement cleanup；基礎 contact radius 亦由 `14` 調為 `16`，並已加入開發版 unlock snapshot 與卡池。
8. **Damage Spread 核心已完成，directional transfer 待重作**：把舊 Attack Area Module 遷移為 Damage Spread，加入 discriminated Rank payload、`24` world-unit 原始 Shape 外圍 band geometry、跨 owner living-Cell 查詢、attack-event 最高值去重、小數 Durability 正規化、噴火槍 `0.125` rebalance 與 spread feedback。三把武器共用同一套 spread 契約，同時保持各自 point／Cone／orbit Circle 的原始 Shape；卡片與 target preview 由 Runtime 提供完整 Rank 摘要。現有 topology-frontier 使用最近目標、立即傷害與 source-to-target 直線，三者皆已過時；必須依 9.1 節改成武器專屬方向優先、鑽通後 fallback、逐 Cell pulse，以及抵達時才扣傷害／更新目標亮度。在全部完成前不得把 directional transfer 標記為完成。
9. **已完成**：加入 Projectile Count。Rank I～III 使用總數 `2／3／4`；assisted `o` 使用 `8°` 間隔的一次 target-query volley，噴火槍使用 `10°` 間隔的獨立 Cone events，能量球維持共同 base phase 並均分完整軌道；卡片與 target preview 顯示 Runtime-authored total-count summary，並記錄實際 attack emission diagnostics。
10. **已完成**：加入 Range。Rank I～III 使用完整總倍率 `×1.15／×1.30／×1.50`，並以 pattern-specific resolved fields 保持三把武器的語意差異。Assisted `o` 使用 emission-time maximum path-distance snapshot、實際 travelled-path 扣除、final partial collision 與 pool reset，acquisition／lock 也讀取 resolved range；噴火槍的 Damage Event、Damage Spread geometry 與 Flame Emitter 共用同一 resolved Cone length；能量球以 deterministic radial sweep 在基礎半徑與 resolved maximum radius 間往返，使用前一步到目前位置的 swept collision，且安裝／升階造成的 profile rebase 不會被誤算成長距離掃掠。卡片 target 與確認畫面顯示 Runtime-authored、weapon-specific 的升級前後距離摘要；完整驗證後 Range 已加入正式 Module card pool。
11. **後續切片**：逐項評估 Duration、Pierce、Explosion、Fire、Ice、Lightning，每項先定義跨武器與 Glyph interaction，再擴充渲染。

## 16. 尚待內容調校

以下不是可由工程自行硬編碼的產品不變量：

- 三把確認武器之後的追加名單與永久解鎖條件；
- 已確認的 Attack Speed、Projectile Count、Damage Spread、Range、Knockback 之外，其餘 Module 的最大 Rank、每階效果與是否存在特殊互斥；
- 第一次升級除保證武器卡之外的兩張卡如何加權；
- 後續武器卡／Module 卡比例與防連續重複規則；
- 新 Weapon Instance 的首次攻擊 cooldown handoff；
- 普通敵人差異化 XP、Elite／Boss XP reward 與十級後的長期曲線調校；
- 元素共存、互斥或組合規則；
- 武器成熟、進化與少量專屬 Module 的出現條件；
- 未來是否以明確能力修改 `maximumEquippedWeapons` 或 replacement retention policy。
- Player Survival Modules 的 Rank tables、跨武器聚合、current-value 調整與效果移除語意；確認前不得加入 card pool，詳見 [`player-survival.md`](player-survival.md)。

本文件已列出的武器傷害、cadence、幾何尺寸、Module 倍率／band ratios 與 XP curve 仍是易於替換、必須驗證的 prototype defaults；實作不得把它們複製成散落的系統常數。上述尚未確認項目則不得由工程自行補完或提升成 `spec.md`／`AGENTS.md` 的永久規則。
