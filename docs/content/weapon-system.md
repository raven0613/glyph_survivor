# Weapon System — Run Loadout, Cards, and Modules

> 狀態：本文記錄已確認的武器、單局裝備、升級卡與 Module Slot 產品／工程契約。首三把武器身分、Damage Spread、Projectile Count、Range、XP 曲線、XP 掉落物呈現、集中戰場 visual theme、怪物暗色基礎 palette／發亮階級分離，以及切片 1～10 的既有核心功能已實作。集中 theme 已改用 `#RRGGBB` authoring strings，並在 content preparation 一次轉換成 numeric tint。Damage Spread 跟隨來源 `PLAYER_ATTACK_VISUAL_ROLE` accent 色系，以及 directional topology-frontier、逐 Cell pulse、抵達時傷害 commit 的契約亦已實作；舊端點連線已移除。永久解鎖條件、卡片權重與後期內容仍待 content tuning。

本文是武器系統工作的詳細入口。跨系統的產品方向以 [`spec.md`](../../spec.md) 為準，依賴方向、Runtime 權威與 Glyph 傷害規則以 [`AGENTS.md`](../../AGENTS.md) 為準。若修改武器、升級、裝備欄、Module、卡片抽選或相關 UI，必須同時閱讀這三份文件。若工作涉及玩家生命、護盾、生存 Module、武器統計或死亡結算，還必須閱讀 [`player-survival.md`](player-survival.md)。Run Modifier 是獨立的 Boss reward／world-rule domain，不是 `MODULE` choice，也不占 Weapon Slot；其完整契約見 [`run-modifiers.md`](run-modifiers.md)。

## 1. 核心目標

武器系統必須支持以下 Build 循環：

1. 玩家在一局開始前，從已永久解鎖的武器中選擇一把初始武器。
2. 玩家升級時，從三張混合卡片中選擇一張；卡片可能是新武器，也可能是通用 Module。
3. 新武器擴充或替換本局裝備；Module 則投資到指定武器的 Module Slot。
4. 相同 Module 再次投資會在原 Slot 升階；不同 Module 可以覆蓋既有 Slot，使後期 Build 仍能調整方向。
5. 每次投資都必須改變武器或玩家生存的明確能力軸或策略；武器戰鬥類 Module 仍須保留該武器自己的 TargetStrategy、AttackPattern、DamageShape 與 DestructionProfile 身分。

不要把此系統實作成全域的 `Damage +10%` 清單，也不要讓 Module 直接修改 Enemy／Boss Entity HP。所有傷害仍必須經過 Glyph Cell、Impact Cells、Damage Targets 與 Material 規則。

不同 Run Modifiers 可以同時改變本局世界規則，但它們不進入本文件的 Weapon／Module loadout、Rank、Slot、replacement 或 XP offer transaction。武器只提供 snapshotted base attack identity／damage；Modifier 在共同 durability-application boundary 依 [`run-modifiers.md`](run-modifiers.md) 合成。

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
- 首版所有武器必須符合同一個 Module Slot count 約束；每把武器的 current count 由它的 Weapon Definition 明確保存，共同約束由 [`weaponDefinition.ts`](../../src/game/content/weapons/weaponDefinition.ts) 驗證。Runtime／UI 不得另寫預設數字。
- Slot 為空，或保存一個 module definition ID 與目前 Rank。
- Slot index 在武器存續期間保持穩定，供 UI 預覽與原子 command 使用。

### Numeric authoring 與測試來源

Production tuning values 不以本文為 source of truth。Current values 只存在下列 validated authoring modules，並在 LOADING 進入 immutable prepared content：

- assisted `o`：[`basicProjectileWeapon.ts`](../../src/game/content/weapons/basicProjectileWeapon.ts) 與 [`projectileTracking.ts`](../../src/game/content/weapons/projectileTracking.ts)；
- 噴火槍：[`flamethrowerWeapon.ts`](../../src/game/content/weapons/flamethrowerWeapon.ts)；
- 環繞能量球：[`orbitEnergyBallWeapon.ts`](../../src/game/content/weapons/orbitEnergyBallWeapon.ts)；
- Module Rank payload、emission spacing 與 Damage Spread 參數：[`prototypeWeaponModules.ts`](../../src/game/content/upgrades/prototypeWeaponModules.ts)；
- XP curve：[`levelProgression.ts`](../../src/game/content/upgrades/levelProgression.ts)；
- loadout-wide content values：[`gameContent.ts`](../../src/game/content/gameContent.ts)。

本文只保存參數名稱、單位、公式、相對關係、ownership、validation 與行為不變量，不複製 current default。其他產品／工程文件也必須連到上述 authoring source，不得抄出另一份 prototype value。

Production-content tests 遵守相同規則：content wiring tests 對照 canonical authoring／preparation function或驗證schema、identity與freeze；system／integration tests從該test world的prepared Weapon Definition、resolved Weapon Profile與prepared Module Rank payload推導期望值。只有數學常數、明確不可調產品不變量，或由測試自行建立且不代表production config的公式／validation fixture可以直接寫numeric literal。單純調整authoring default不應要求修改本文或一般behavior assertion。

### Upgrade Offer

- 一次升級事件產生的三張 immutable、UI-sized choice references。
- 具有 stable offer ID；任何選擇 command 都必須攜帶該 ID，讓 Runtime 拒絕過期、重送或雙擊 command。

## 3. 開局與永久解鎖

- `READY` 階段提供已永久解鎖武器的 UI summaries；fixed simulation 尚未開始。
- 玩家必須選擇且只能選擇一把合法的初始武器，Runtime驗證後才建立本局Weapon Instance。正式path接著進入`RUNNING`；若 [`run-modifiers.md`](run-modifiers.md) 的`enableRunStartModifierOfferForTesting`已在LOADING凍結為true，則先在第一個fixed step前進入一次`PAUSED_MODIFIER`測試offer，commit後才初次進入`RUNNING`。無效初始武器不得建立測試authorization。
- 未解鎖、未知或過期的 weapon definition ID 必須被拒絕，不得以 fallback 武器靜默開局。
- 本局使用的 unlocked weapon set 必須在 run 開始時凍結。主選單或 persistence 狀態後續改變，不得在同一 run 中途改寫卡池。
- 永久解鎖的條件、結算獎勵與 save migration 不屬於本文件目前的單局實作範圍；未確認前不得在 weapon system 中自行發明。
- Persistence 尚未接入前，開發版 prototype unlock snapshot 包含 assisted `o`、噴火槍與環繞能量球，使玩家無論選哪一把開局，第一次升級都仍有 eligible weapon。這只是可替換的開發預設，不是永久解鎖條件。

## 4. 本局裝備欄

- `maximumEquippedWeapons` 必須從 [`gameContent.ts`](../../src/game/content/gameContent.ts) 的 prepared content 讀取；它不是可以散落在系統、UI 或測試中的預設數字。
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

Module Rank 不是 Player Level 或 Weapon Level；它只描述某個 Slot 內同一 Module 的投資階段。效果應由 content 提供明確、可驗證的 rank table。每一列保存該 Rank 的**完整總效果**，不是從前一 Rank 再疊乘的增量。不得把 `I`、`II`、`III` 寫成互不相干、容易漂移的 definitions。

已實作的首批 prototype Modules 與 effect payload 語意如下；current Rank values 只讀取 [`prototypeWeaponModules.ts`](../../src/game/content/upgrades/prototypeWeaponModules.ts)：

| Module | Effect payload 語意 |
| --- | --- |
| Attack Speed | Rank保存完整總attack-rate multiplier；interval由base interval除以該prepared value |
| Projectile Count | Rank保存一次AttackPattern的總emission／stream／ball數量，不是額外增加量 |
| Damage Spread | Rank保存從原始DamageShape外緣起算的完整band-ratio陣列 |
| Range | Rank保存武器可到達距離的完整總倍率；依AttackPattern編譯成acquisition／travel、Cone length或maximum radial-sweep radius |
| Knockback | Rank保存武器impact／root knockback strength的完整總multiplier |

每個 Damage Spread Rank 的數列已包含該階完整效果；後一 Rank 不是在前一 Rank 之外再疊加另一組舊 bands。Range 的每個 Rank 也代表相對於該武器 base reach 的完整總倍率，不得在前一 Rank 上再次乘算。Module effect schema 必須允許 discriminated rank payload，例如 spread 的完整 band ratios，不能假設所有 Module 都只有一個 `totalMultiplier`。這些倍率／比例集中在 content，可經 playtest 替換，不是不可改動的產品常數。其他 Module 可以有不同最大 Rank 或非線性 rank table。

### 6.1 未來 Player Survival Modules

生命、最大生命、護盾層數、護盾回復與護盾破裂相關升級，未來仍以 `MODULE` choice 進入相同交易流程：玩家選擇 Weapon Instance、占用其 ordered Module Slot、同類升 Rank，並受覆蓋與武器替換摧毀規則約束。玩家生存效果可以由 Runtime 從目前裝備的 Module Slots 編譯成獨立 survival profile，不得為了沿用武器熱路徑而硬塞進 `ResolvedWeaponProfile`；Module Slots 仍是唯一投資來源。

本里程碑不建立這些 Module definitions、Rank tables、card-pool entries、preview 或 transaction 分支，也不自行決定最大生命／護盾效果被覆蓋或替換時的 current-value 調整規則。已確認範圍與仍待決策項目集中在 [`player-survival.md`](player-survival.md)。

## 7. XP 升級混合三選一卡池

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

本節「恰好三張」只適用於 XP 的 `WEAPON | MODULE` offer。Boss Modifier reward 使用自己的 offer ID、choice kind、RNG、owned-definition exclusion與`PAUSED_MODIFIER` transaction；當只剩兩個eligible Modifier definitions時可以二選一，不能為了補滿三張而塞入已持有Modifier。

若一次取得多個 level-up，Runtime 以 pending count 排隊。完成一個有效投資或武器取得後，若仍有 pending level-up，直接產生下一個 offer 並保持 `PAUSED_UPGRADE`；不得在兩次選擇之間短暫恢復 simulation。

### 7.1 XP 曲線與升級觸發

首版以 `level`、`xpIntoLevel` 與 `pendingUpgradeCount` 表示升級進度。`xpIntoLevel` 是目前等級內已累積的 XP，不是已花費 XP 的 lifetime total。由目前等級 `L` 升到下一級所需 XP 使用 [`levelProgression.ts`](../../src/game/content/upgrades/levelProgression.ts) 的 prepared parameters：

```text
L <= earlyLevelLimit:
  xpToNext(L) = earlyBaseXp + L × (L + 3) / 2

L > earlyLevelLimit:
  xpToNext(L) = lateBaseXp
                + lateXpPerLevel × (L - earlyLevelLimit)
```

`L` 是升級前的目前等級。本文不複製 current threshold table；Runtime與tests都由同一份prepared progression計算。

XP 結算遵守以下規則：

- 首版 Z、BO、BAT 使用各自 prepared creature content 提供的合法死亡 XP reward；不同普通敵人、Elite 與 Boss 的差異化 reward 必須由content明確定義，不得讓Boss／Elite意外繼承普通敵人的fallback。
- 同一 fixed step 撿到的 XP 先累加，再以 `while` 逐級扣除門檻；所有超額 XP 必須保留。
- 每跨過一級就增加一次 `pendingUpgradeCount`。一次跨多級只建立第一個 active offer，其餘選擇排隊，並在前一個 commit 後依更新後的 loadout 重新產生。
- 第一次武器卡保證依 `offerSequence === 0` 判斷，不依 `level === 2`；大額 XP 一次跨多級不得重複觸發首次保證。
- 第一個升級的playtest節奏目標不是寫死的Gameplay時間門檻；若實測偏慢，優先調整curve與reward content，而不是在系統中加入特例。量測目標若需要版本化，應另存明確balance-acceptance artifact，不得混成Runtime default。
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

### 9.1 首三把武器與 authoring sources

首版武器身分依 TargetStrategy、AttackPattern、DamageShape 與 DestructionProfile 分離，不得把非 projectile 武器塞入 single-projectile profile 的假欄位：

| 武器 | TargetStrategy | AttackPattern | DamageShape | DestructionProfile |
| --- | --- | --- | --- | --- |
| Assisted `o` | `AIM_ASSISTED` | `SINGLE_PROJECTILE` | `POINT`／`SINGLE` | `MATERIAL_IMPACT` |
| 噴火槍 | `PLAYER_AIM` | `PULSED_CONE` | `CONE`／`AREA` | `MATERIAL_IMPACT` |
| 環繞能量球 | `OWNER_RELATIVE` | `PERSISTENT_ORBIT` | `CIRCLE`／`AREA` | `KNOCKBACK_CONTACT` |

三把武器各自引用 semantic attack-presentation roles，實際色系與 alpha 由集中 Battlefield Visual Theme 決定。Attack event 必須 snapshot 這個 `PlayerAttackVisualRoleId`，使 projectile travel、Cone pulse 或 orbit contact 延後解析 Damage Spread 時仍保留來源色系。直接 Impact feedback 使用怪物自己的 Appearance Profile；Spread Target feedback 使用來源 attack role 的 `accent` tint。所有玩家攻擊核心 role 都高於 XP 新生／閃爍峰值與怪物受擊峰值；Weapon content 與 renderer 不保存另一套固定色值，也不得依武器 ID 寫 spread 顏色分支。

傷害高低比較以「一個 Damage Target 每次有效命中」為單位：產品關係保持 `assisted o damage > orbit damage > flamethrower damage`。Current values 分別只存在三把武器的authoring definition；AREA武器可以同時選中多個Damage Targets，因此總傷害與清怪能力不能只用單次數值比較。對任意Cell，需要的有效命中數由`ceil(Current Durability / prepared damageAmount)`推導，本文不保存由current tuning值算出的命中次數。

#### Assisted `o`

- 遠距單體基準武器；保留有限的 assisted correction，錯過或失去原目標後永久轉為 ballistic。
- Current base profile與tracking values只存在[`basicProjectileWeapon.ts`](../../src/game/content/weapons/basicProjectileWeapon.ts)及[`projectileTracking.ts`](../../src/game/content/weapons/projectileTracking.ts)。Maximum travel distance是明確distance budget；Runtime依每步實際travelled path扣除，不讓lifetime暗中兼任Range contract。
- Gameplay projectile 使用小寫 `o`；projectile position、collision、target 與 damage 都由 Runtime 權威持有。
- 若安裝 Range，初次 target acquisition range、對原目標的 lock-maintenance range，以及沿 projectile 實際彎曲路徑消耗的 maximum travel distance 都套用該 Rank 的 prepared完整總倍率；projectile speed、DamageShape radius、assisted correction angle與steering responsiveness不變。每顆在途projectile使用emission-time distance snapshot，最後一段部分距離仍必須有一次collision機會。
- 若安裝 Damage Spread，外圍距離以 projectile 的本次原始 point／circle impact shape 為起點。
- 無論是否安裝 Damage Spread，直接命中 `HUSK` 時，使用 projectile 碰撞當下經 assisted correction 後的實際 velocity direction，優先選擇該向前射線第一個相交的同 body 存活 Cell；只有射線上已沒有存活 Cell，才 fallback 到 topology distance 最近的 frontier。遠端主傷害不受 spread band 距離限制，也不會因此把擴散轉移過去。Runtime 建立逐 Cell pending transfer，pulse 抵達前目標維持原 Durability／狀態／亮度，抵達時才套用 emission-time prepared damage 與目標受擊亮度；不得畫端點連線。

#### 短程寬角噴火槍

- 沿玩家目前的 authoritative aim direction 攻擊，不執行敵人 target selection 或 tracking。
- Current base profile只存在[`flamethrowerWeapon.ts`](../../src/game/content/weapons/flamethrowerWeapon.ts)。
- 若安裝 Range，只對從 muzzle origin 起算的 authoritative Cone 軸向長度套用prepared完整總倍率；full angle、muzzle distance、damage、pulse interval與rendering-only particle count都不變。
- 每次 damage interval 產生一次瞬時 authoritative Cone DamageShape。Broad phase 可以用包覆圓查詢 owner，但 precise hit 必須逐一測試完整 Glyph outline 與 Cone，包括 `HUSK`。
- Cone 是 AREA attack；每個 owner 的 target quota 等於其 distinct Impact Cells 數量，living Impact Cells 優先。每個造成缺額的 Husk Impact Cell 都使用從該 Cone stream 的 muzzle origin 穿過自身的局部射線，優先鑽向該射線第一個存活 Cell；不能讓整個扇形的所有 Husk 共用平行中心軸。只有一條局部射線已鑽通時，該來源才 fallback 到最近 topology frontier。多來源必須去重，同一 attack event 不能讓同一目標重複受傷。只有實際 Cone 內的 Impact Cells 取得 primary hit flash、粒子與 Material response；遠端目標等各自的逐 Cell pulse 抵達才扣傷害並顯示受擊亮度。
- 一道 Cone stream 的一次 pulse 是一個 attack event。Cone 內的所有幾何取樣、Impact Cells 與 owner queries 都共享同一 event ID，不能讓同一 Cell 因落入多個取樣區而重複吃直接或擴散傷害。Projectile Count 產生的每一道 Cone stream 則各自建立 event；多道 Cone 重疊時，每一道火仍可各造成一次傷害。
- 若安裝 Damage Spread，bands 從**整個 authoritative Cone 的外圍**向外計算，包括其弧形遠端與兩側邊界；不得由每顆 rendering 火星、每個 Cone 取樣點或每個 Impact Cell 各自產生擴散圈。
- `.`、`*` 飛散使用集中設定的 fire-spectrum presentation roles，且仍是 rendering-only presentation；調整其實際色值或把視覺密度降為零時，傷害結果必須完全相同。不得把每顆火星建立成 gameplay projectile。
- 首版「火焰」只代表武器外觀與攻擊形狀，不包含 Fire DoT、燃燒疊加、刷新或元素組合。這些仍等待獨立 Glyph status contract。

#### 環繞能量球

- 能量球核心使用 Printable ASCII `O`。軌道相位、world position、collision radius、damage 與 per-owner re-hit cooldown 都是 Runtime 權威資料；Renderer 不得自行繞著玩家計算 gameplay position。
- Current base profile只存在[`orbitEnergyBallWeapon.ts`](../../src/game/content/weapons/orbitEnergyBallWeapon.ts)。
- `orbitRadius` 是玩家 root 到球心的軌道半徑，`damageShape.radius` 是以球心為中心的 authoritative contact Circle 半徑；內圈與外圈不是兩個獨立 content fields。不計目標 Glyph 自身 collision radius時，球心傷害環帶為`orbitRadius - damageShape.radius`到`orbitRadius + damageShape.radius`；精確相交仍須再納入各Glyph的authoritative collision radius。若要同時讓內圈往內、外圈往外增加視覺接觸容錯，應集中調高contact radius；修改orbit radius只會平移整個環帶，不得拿來冒充對稱擴張。
- 若安裝 Range，prepared base orbit radius仍是每顆球deterministic radial sweep的最小／基礎半徑，prepared完整總倍率只決定maximum radius。Range不放大Weapon Definition的base contact radius，避免把Range混成Attack Area；多球維持等角度分布並使用穩定錯開的radial phase，不能全部同時移到外圈。
- 每顆球是依附 Weapon Instance 的 persistent attack，不是一般 `ProjectileState`。武器被替換或移除時，所屬球、hit history 與 instance-owned state 一起終止。
- 球的 Circle 與完整 Glyph outline 精確相交；命中後不消失。接觸紀錄以「每顆球 × 每個 creature owner」獨立保存：球新進入某個 owner，或離開後再次進入時，這個新 contact episode 必須立即可命中，不受上一段持續接觸計時限制；只有球與該 owner 連續重疊時，成功命中才以prepared `rehitCooldownMs`節流，避免每個fixed step都造成傷害。即使Attack Speed讓球在該cooldown內繞完一圈，離開後重新接觸仍應立即命中。
- Broad／precise sweep 找到 owner 候選本身不得開始或刷新節流；只有 Damage System 確認本次 DamageShape 至少取得一個 Impact Cell 時，才提交該次成功命中並開始prepared `rehitCooldownMs`。Husk也是合法Impact Cell；其直接傷害若建立pending topology transfer，仍視為這次成功接觸，但遠端目標要等pulse抵達才受傷。
- 球與移動中的 creature 必須以雙方 previous-to-current authoritative motion 做 relative swept-circle broad／precise collision，並以實際 contact point 建立本次 Circle DamageShape；不得只測 fixed-step 終點，也不得只掃球而把 owner 當作靜止。Range Rank 改變時保留共同 phase，但 profile-revision rebase 不能被誤判成一條長距離 sweep attack。
- 能量球在程式上是小型 Circle AREA，而不是 SINGLE Point。每個 Husk Impact source 的 traversal direction 使用 previous authoritative ball position 到實際 contact point 的 swept-motion direction，包含 Range 造成的徑向分量；不得拿玩家到球心的向外方向代替。
- 擊退方向仍由玩家 root 指向球心，將整個 creature root 向外推離玩家；它與 traversal direction 是兩個獨立欄位。所有 active outline Glyphs 隨 root 位移。只有實際 Impact Cells 同時取得局部 Material hit response，遠端 pending Damage Targets 不得取得局部位移或 primary hit effect，並在 pulse 抵達時才扣傷害與改變亮度。
- 若安裝 Damage Spread，bands 從這次直接接觸所使用的 authoritative ball Circle 外緣向外計算，不從每個被球碰到的 Cell 再各自產生一圈。擴散本身不複製能量球的 whole-body knockback。
- 主球 `O` 是 authoritative attack 的 render representation；光暈、拖尾與周圍粒子是 rendering-only。暫停時軌道與 gameplay-synchronized presentation time 都不前進。
- 本武器已完成 persistent orbit、每球／owner contact episode、prepared cooldown連續接觸節流、成功 Impact Cell才提交gate、球／owner relative swept collision、whole-body knockback與replacement cleanup，並已加入開發版unlock snapshot與卡池。

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

- Attack Speed：assisted `o` 縮短 firing interval；噴火槍縮短 Cone damage interval；能量球提高 authoritative angular speed，使球更快繞行。Prepared `rehitCooldownMs` 只限制同一球／owner 的連續接觸成功命中，不隨 Attack Speed 縮短；離開後再次進入的新 contact episode 仍立即可命中。
- Projectile Count：每個 Rank 的 prepared `totalCount`、assisted `o` 的 `projectileAngleSpacingRadians` 與噴火槍的 `coneAngleSpacingRadians` 都由 Module definition 提供；能量球在完整軌道上依 prepared 總球數等距分布。
- Damage Spread：三把武器都使用本節下方的共同空間與 Rank 規則，差別只在它們各自的原始 point／circle、Cone 或 orbit-contact Circle。
- Knockback：放大 Impact Cells 收到的 local impact strength；若武器明確具有 whole-body knockback profile，也同時放大其 authoritative root impulse。Root displacement 與 local Glyph Material response 是兩個分離效果。

Projectile Count 的首三把武器語意如下；current Rank values 與 spacing 只讀取 [`prototypeWeaponModules.ts`](../../src/game/content/upgrades/prototypeWeaponModules.ts)：

- assisted `o`：同一次 volley 只執行一次初始 target query，所有 projectile 共用該初始 target；方向以瞄準軸為中心對稱排列，相鄰方向使用 prepared `projectileAngleSpacingRadians`。每顆 projectile 仍有自己的 authoritative state、碰撞與 emission-time profile snapshot。
- 噴火槍：Cone streams 以瞄準軸為中心對稱排列，相鄰中心方向使用 prepared `coneAngleSpacingRadians`；每道 Cone 都是獨立 attack event，重疊處不互相取消傷害，且每道都有對應 rendering-only emitter summary。
- 能量球：同軌道的 authoritative balls 依 `ballIndex / totalCount` 所佔的完整軌道比例等距錯開。Rank 改變時保留共同 base phase，並重新均分所有現存／新增球，不讓新增球固定從世界零角度插入。

Range 的 Rank table、獨立 content definition、首三把武器的 resolved mapping，以及 assisted `o`／噴火槍 Runtime 行為已完成；該 definition 目前刻意不註冊進正式 Module pool。在能量球 radial sweep／swept collision 與 weapon-specific preview 完成前仍不得進入 card pool。Duration、Pierce 與 Element 仍須先定義跨武器、非 no-op 且無隱藏負面效果的語意。尤其不能把 orbit 的固定 radius 直接向外搬來冒充 Range，因為那會永久製造新的近身死角。

### 10.1 Range 的共同規則

Range 每個 Rank 保存相對於 Weapon Definition base reach 的完整 prepared `totalMultiplier`；resolved reach 為 `base reach × totalMultiplier`。Resolver 必須依 discriminated AttackPattern 編譯明確欄位，不得新增一個被所有武器盲目共用的含糊 `rangeMultiplier` hot-path 判斷：

1. Assisted `o`：同時解析 initial acquisition、lock-maintenance 與 maximum path-distance budget。Base acquisition／lock 與 base maximum travel distance 分別讀取 prepared tracking profile 與 Weapon Definition。距離 budget 依實際 travelled path 扣除，speed 與 guidance profile 不變；final partial segment 仍參與 collision，pool reuse 必須完整 reset 剩餘距離。
2. 噴火槍：只以 Weapon Definition 的 base Cone length 乘上 prepared Rank `totalMultiplier` 解析 authoritative Cone length。同一次 emission 的 Damage Event 與 Flame Emitter snapshot 必須取得同一 resolved length；Renderer 只把該 snapshot 視覺化，不能從最遠火星位置反推命中。
3. 能量球：保留 Weapon Definition 的 base `orbitRadius` 與 contact `damageRadius`，只將 maximum radial-sweep radius 解析為 `orbitRadius × totalMultiplier`。每顆球的 angle 與 radial phase 都由 Runtime 依共同 phase、ball index 與 total count 確定性求出；Attack Speed 可以讓共同 phase 更快前進，但 Range 不改 prepared `rehitCooldownMs` 或 contact Circle 大小。
4. 能量球每步使用球與 owner 雙方 previous-to-current motion 的 relative swept Circle 查詢。Broad phase 包覆完整相對 motion，precise phase 對 authoritative Glyph circles 求實際 contact point；Damage Event、Damage Spread、local Material response 與 outward whole-body knockback 都以該接觸位置／方向解析。Profile revision 可以重新對齊新 sweep range，但不得把 upgrade snap 當成一次穿越整段空間的攻擊。
5. Range 不改任何 Damage Spread Rank 的 `bandWidth` 或 ratios。Assisted `o` 仍從實際 projectile contact Circle 外緣、噴火槍從延長後的完整 Cone 外緣、能量球從本次接觸 Circle 外緣開始 spread；Range 只改原始攻擊可到達的位置／長度。
6. Upgrade choice 可以顯示通用 Rank multiplier，但 weapon target 與 confirm preview 必須由 Runtime 提供實際 before／after summary，分別表達 assisted target／travel、Cone length 或 orbit base-to-maximum sweep。React 不得讀 content registry 或自行重算這些數字。
7. Range content 可以在未註冊進正式 offer pool 的狀態下分階段完成 schema 與行為；只有三把確認武器都具備非 no-op mapping、必要 preview 與驗證後，才以同一個可見切片啟用卡片。

### 10.2 Damage Spread 的共同規則

Damage Spread 先完成原始攻擊的 Impact Cells 與直接 Damage Targets，再以同一 attack event 解析外圍擴散：

1. 原始 DamageShape 必須先取得至少一個 Primary Impact Cell；完全落空的 attack event 不觸發 spread。接著以該 event 的**原始完整 DamageShape**為零距離邊界，求每顆候選 Glyph Circle 到 Shape 的最短外部距離；Shape 內或與 Shape 相交者不是 spread-only target。
2. `bandWidth` 由 prepared Damage Spread Module definition 提供。對正距離 `d`，第 `n` 圈為 `(n - 1) × bandWidth < d ≤ n × bandWidth`。Weapon、creature、system、renderer 與測試不得複製 current width。
3. 每個 Rank 的 prepared `bandDamageRatios` 是該階完整的 band-ratio 陣列；每個比例乘上這次 emission／contact 已解析且已 snapshot 的 main damage。Runtime 不得把前一 Rank 陣列再叠加一次。
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

Modifier reward 使用獨立的 React overlay與Runtime transaction，不應把無Weapon／Slot target的world-rule choice塞進Upgrade decision state machine。兩種screen可以共用純presentation card shell，但不能共用權威offer type或commit command。

React 可以使用 CSS、SVG 或 Web Animations 呈現文字聚合、staggered entry、3D tilt、neon border、scanline、glitch、code diff 與 Rank compile 等效果。動畫應以 `transform`／`opacity` 為主，避免以 React state 驅動每一幀，並提供 `prefers-reduced-motion` 路徑。

Damage Spread 卡與 target preview 顯示該 prepared Rank 的完整 `bandDamageRatios`；Projectile Count 顯示該 prepared Rank 的 `totalCount`。Range 卡可以列出 prepared `totalMultiplier`，但選擇 target weapon 與確認 transaction 時必須顯示 Runtime-authored、weapon-specific before／after reach，例如 assisted acquisition／travel、Cone length 或 orbit sweep interval。不得把這些效果偽裝成不相干的 multiplier，或由 React 自行推算。這些仍是 UI-sized immutable summaries。

整個決策鏈都維持完全暫停：

```text
choose card
→ choose target weapon
→ optionally choose replacement Slot／weapon
→ validate and commit
→ next queued offer or RUNNING
```

Gameplay time、cooldown、projectile、enemy、damage、drop 與 director 都不得前進。UI animation 使用獨立的 DOM／CSS clock，可以在 gameplay simulation 暫停時繼續播放。

若Boss Modifier reward之後仍有pending XP upgrade，直接由`PAUSED_MODIFIER`進入`PAUSED_UPGRADE`並保持完整暫停；只有最後一個decision成功後才回到`RUNNING`。

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

- 武器數量雖然首版最多三把，weapon loop 仍不得在 fixed step 配置暫時 effect-composition structures。
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
- creates no run-start Modifier testing authorization until after a valid initial Weapon Instance exists and still executes no fixed step before that offer commits
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
- preserves fractional durability for the prepared flamethrower `damageAmount` and normalizes near-zero residue to `HUSK`
- classifies every spread band from the exterior of the original whole DamageShape
- applies every configured Damage Spread Rank's complete prepared `bandDamageRatios` without compounding prior Ranks
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
- compiles every configured Projectile Count Rank from its prepared `totalCount`
- emits one assisted projectile volley from one target query with centered prepared `projectileAngleSpacingRadians`
- emits independent centered Cone events with prepared `coneAngleSpacingRadians` and allows overlap damage
- keeps orbit balls evenly phase-spaced when Projectile Count changes
- compiles every configured Range Rank from its complete prepared `totalMultiplier` without compounding prior Ranks
- extends assisted acquisition、lock maintenance 與 maximum travelled path distance without changing projectile speed、radius 或 guidance profile
- lets a projectile's final partial Range segment participate in collision and fully resets its pooled distance state
- extends the authoritative Cone and rendering-only Flame Emitter with one identical resolved length while preserving angle、damage、cadence 與 particle count
- keeps Damage Spread band width／ratios unchanged and starts it from the Range-adjusted primary shape exterior
- sweeps each orbit ball from its prepared base `orbitRadius` to the resolved maximum while keeping its prepared contact `damageRadius` and deterministic multi-ball phase offsets
- detects orbit contacts across the complete previous-to-current swept Circle without treating a Range Rank rebase as a long attack
- lets a new orbit contact episode hit immediately while throttling only continuous overlap per ball／owner at the prepared `rehitCooldownMs`
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
- keeps orbit phase deterministic, tracks contact episodes per ball／owner, throttles continuous overlap at the prepared `rehitCooldownMs`, and clears its balls and hit history with its Weapon Instance

## 15. 首版實作切片

1. **已完成**：將 assisted `o` 準備成 immutable Weapon Definition，建立 World-owned loadout、stable Weapon Instance、獨立 cooldown 與固定 Module Slots。
2. **已完成**：讓 `READY` 以 frozen unlocked summaries 選擇一把合法初始武器，驗證後才開始 run。
3. **已完成**：完整加入第二把實際武器噴火槍、XP curve／overflow／pending count、mixed card offer、dedicated upgrade RNG、第一次升級武器卡保證，以及 domain 到 GameHost 的完全暫停邊界。未完成的能量球未放入卡池。
4. **已完成**：以 Attack Speed、舊 Attack Area prototype、Knockback 證明空格安裝、同類升階、最大 Rank 拒絕、滿格覆蓋、stale offer 拒絕與連續 pending offer 的原子流程；並將 ordered Slots 編譯成 revisioned `ResolvedWeaponProfile`，保留在途 attack 的 emission-time snapshot。Attack Area 在這一步只是用來驗證管線，不再代表目前確認的產品方向。
5. **已完成**：接上武器卡的原子取得交易；未滿上限時建立空 Slots 的新 Weapon Instance，滿裝時要求明確 replacement instance、保留 equipment position、摧毀舊實例投資與 runtime state，且不改動其他武器。替換不清除獨立在途 projectile，其攻擊資料繼續使用生成時 snapshot；instance-attached orbit 則依明確 lifecycle rule 立即終止並清除 hit history。
6. **已完成**：以 Canvas 上方的 React DOM overlay 完成三張卡、武器 target、Module Slot overwrite、weapon replacement、返回／確認與 recoverable error 流程。UI 使用純 preview view-model 組出最終 command，Runtime 仍原子重驗；並加入鍵盤 `1–3`／Tab／Enter／Escape 操作、初始 focus、responsive layout、staggered text aggregation、3D tilt、neon scanline、glitch 與 code-diff compile 動畫，且提供 `prefers-reduced-motion` 路徑。
7. **已完成**：實作 Runtime-owned persistent orbit 能量球、精確 Glyph Circle impact、每球／owner contact episode、新接觸立即命中、prepared `rehitCooldownMs` 連續重疊節流、成功 Impact Cell 才提交 gate、球／owner relative swept motion、whole-body outward knockback、Module 對應語意、render snapshot 與 replacement cleanup，並已加入開發版 unlock snapshot 與卡池。
8. **Damage Spread 核心已完成，directional transfer 待重作**：把舊 Attack Area Module 遷移為 Damage Spread，加入 discriminated Rank payload、prepared `bandWidth` 的原始 Shape 外圍 band geometry、跨 owner living-Cell 查詢、attack-event 最高值去重、小數 Durability 正規化、prepared 噴火槍 damage rebalance 與 spread feedback。三把武器共用同一套 spread 契約，同時保持各自 point／Cone／orbit Circle 的原始 Shape；卡片與 target preview 由 Runtime 提供完整 Rank 摘要。現有 topology-frontier 使用最近目標、立即傷害與 source-to-target 直線，三者皆已過時；必須依 9.1 節改成武器專屬方向優先、鑽通後 fallback、逐 Cell pulse，以及抵達時才扣傷害／更新目標亮度。在全部完成前不得把 directional transfer 標記為完成。
9. **已完成**：加入 Projectile Count。各 Rank 使用 prepared `totalCount`；assisted `o` 使用 prepared `projectileAngleSpacingRadians` 的一次 target-query volley，噴火槍使用 prepared `coneAngleSpacingRadians` 的獨立 Cone events，能量球維持共同 base phase 並均分完整軌道；卡片與 target preview 顯示 Runtime-authored total-count summary，並記錄實際 attack emission diagnostics。
10. **已完成**：加入 Range。各 Rank 使用完整 prepared `totalMultiplier`，並以 pattern-specific resolved fields 保持三把武器的語意差異。Assisted `o` 使用 emission-time maximum path-distance snapshot、實際 travelled-path 扣除、final partial collision 與 pool reset，acquisition／lock 也讀取 resolved range；噴火槍的 Damage Event、Damage Spread geometry 與 Flame Emitter 共用同一 resolved Cone length；能量球以 deterministic radial sweep 在基礎半徑與 resolved maximum radius 間往返，使用前一步到目前位置的 swept collision，且安裝／升階造成的 profile rebase 不會被誤算成長距離掃掠。卡片 target 與確認畫面顯示 Runtime-authored、weapon-specific 的升級前後距離摘要；完整驗證後 Range 已加入正式 Module card pool。
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

武器傷害、cadence、幾何尺寸、Module 倍率／band ratios 與 XP curve 的 current defaults 只存在第 2 節連結的 validated authoring sources；本文件只保留契約與公式，不得成為第二份 balance table。上述尚未確認項目則不得由工程自行補完或提升成 `spec.md`／`AGENTS.md` 的永久規則。
