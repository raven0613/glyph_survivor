# Weapon System — Run Loadout, Cards, and Modules

> 狀態：本文記錄已確認的武器、單局裝備、升級卡與 Module Slot 產品／工程契約。這是目標設計，不代表目前程式已完整實作。個別武器數值、Module Rank 效果與抽選權重仍是後續 content tuning。

本文是武器系統工作的詳細入口。跨系統的產品方向以 [`spec.md`](../../spec.md) 為準，依賴方向、Runtime 權威與 Glyph 傷害規則以 [`AGENTS.md`](../../AGENTS.md) 為準。若修改武器、升級、裝備欄、Module、卡片抽選或相關 UI，必須同時閱讀這三份文件。

## 1. 核心目標

武器系統必須支持以下 Build 循環：

1. 玩家在一局開始前，從已永久解鎖的武器中選擇一把初始武器。
2. 玩家升級時，從三張混合卡片中選擇一張；卡片可能是新武器，也可能是通用 Module。
3. 新武器擴充或替換本局裝備；Module 則投資到指定武器的 Module Slot。
4. 相同 Module 再次投資會在原 Slot 升階；不同 Module 可以覆蓋既有 Slot，使後期 Build 仍能調整方向。
5. 每次投資都必須改變武器的明確能力軸或策略，並保留該武器自己的 TargetStrategy、AttackPattern、DamageShape 與 DestructionProfile 身分。

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
- 定義武器 ID、UI metadata、Module Slot 數量、基礎 combat profile，以及使用的 TargetStrategy、AttackPattern、DamageShape、DestructionProfile 與 tracking profile。
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

已經生成的獨立 gameplay projectile／attack object 使用生成瞬間的 resolved combat snapshot，武器被替換後仍可自然完成。Beam、orbit 或其他必須持續依附 Weapon Instance 的攻擊，則在 owner weapon 被替換時依其明確 lifecycle rule 結束；不得留下查不到 owner 的懸空狀態。

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

Module Rank 的效果應由 content 提供明確、可驗證的 rank table。不得假設所有 Rank 都是線性百分比，也不得把 `I`、`II`、`III` 寫成互不相干、容易漂移的 definitions。最大 Rank 可以依 Module 不同；精確 Rank 數值仍屬 content tuning。

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
DestructionProfile   knockback, pierce, explosion, split, erosion
```

Module 不直接散落修改 projectile、collision 或 damage system。每個 Weapon Instance 以 definition 加上目前 Slot contents 編譯出 `ResolvedWeaponProfile`：

- 只有 Slot 或 Rank 改變時增加 revision 並重新編譯。
- fixed-step firing hot path 讀取 prepared profile，不得每步建立 modifier arrays 或重做 Rank reduction。
- effect 合成順序固定，例如依 Slot index，再依 definition 內的 effect order。
- derived profile 是可丟棄快取；Module Slots 才是投資的權威來源。

每個 damaging attack 仍必須產生明確 DamageShape、Damage Amount 與 Impact parameters。Projectile spawn 時複製本次攻擊需要的 resolved values；在途 projectile 不得每步回查可能已升階或被替換的 Weapon Instance。

## 10. 通用 Module 的能力軸

首批通用 Module 方向包含：

- Attack Speed：改變 weapon cadence／fire interval，並遵守最小安全間隔。
- Projectile Count：改變一次 AttackPattern 的 emission count；非傳統 projectile 武器也必須定義可讀、非 no-op 的對應語意。
- Attack Area：改變 DamageShape 的幾何範圍，不等同於 targeting range。
- Range：改變 target acquisition／attack travel reach；不能用一個含糊欄位同時代表所有距離。
- Duration：改變 projectile、beam、orbit、lingering shape 或 status 的明確 lifetime。
- Pierce：改變可存續的 collision／body-hit budget，不得用來繞過每個 body 的 Glyph Damage Target quota。
- Knockback：改變 Impact Cells 收到的 attack impulse，再由 Glyph Material 決定實際位移與恢復。
- Element：選擇 Fire、Ice、Lightning 等明確 Glyph interaction strategy。

「通用」表示每個可裝備武器都必須有明確、可感知且可驗證的效果，不表示所有武器盲目加同一 numeric field。LOADING 必須驗證首版 Module 對首版武器不是 no-op；若某個能力軸尚未定義跨 AttackPattern 語意，就不要把該卡放進 content pool。

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

- phase、offer ID、pending upgrade count 與 recoverable error；
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
- Attack Speed、Projectile Count 與 chain effects 上線時，追蹤 active attacks、emissions、target queries、damage requests、pool misses 與 simulation p95。
- 抽選、Slot 合成、Rank 編譯、target tie-break 與 firing order 都必須 deterministic，不得使用 `Math.random()`。
- 不得為了效能降低 Glyph DamageShape 精確度、Husk outline 規則或 Impact Cells／Damage Targets 分離。

## 14. 必要驗證

風險導向的純規則測試至少覆蓋：

- rejects an initial weapon that is unknown or not in the frozen unlock set
- guarantees an eligible weapon card in the first upgrade offer
- produces the same three unique cards from the same upgrade seed and state
- does not let enemy RNG consumption change upgrade offers
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

## 15. 首版實作切片

1. 將目前 assisted `o` projectile 準備成第一個 immutable Weapon Definition，行為保持不變。
2. 建立 World-owned loadout、stable Weapon Instance、獨立 cooldown 與固定 Module Slots。
3. 讓 `READY` 以合法 unlocked summaries 選擇初始武器，再開始 run。
4. 建立 mixed card offer、dedicated upgrade RNG 與第一次升級武器卡保證。
5. 先以少量通用 Modules 證明空格安裝、同類升階與滿格覆蓋的原子流程。
6. 接上新武器取得、滿裝 replacement 與在途 attack snapshot。
7. 以 React DOM 完成三張卡、武器、Slot preview／replacement 及動畫 UI。
8. 再逐項加入 Pierce、Explosion、Knockback、Fire、Ice、Lightning；每項先定義 Glyph interaction，再擴充渲染。

## 16. 尚待內容調校

以下不是可由工程自行硬編碼的產品不變量：

- 首批武器名單、永久解鎖條件與每把武器的 Module Slot 數量；
- 個別 Module 的最大 Rank、每階效果與是否存在特殊互斥；
- 第一次升級除保證武器卡之外的兩張卡如何加權；
- 後續武器卡／Module 卡比例與防連續重複規則；
- 新 Weapon Instance 的首次攻擊 cooldown handoff；
- 元素共存、互斥或組合規則；
- 武器成熟、進化與少量專屬 Module 的出現條件；
- 未來是否以明確能力修改 `maximumEquippedWeapons` 或 replacement retention policy。

在上述內容確認前，實作只能使用易於替換、經驗證且清楚標示的 prototype defaults，不能把調校值提升成 `spec.md` 或 `AGENTS.md` 的永久規則。
