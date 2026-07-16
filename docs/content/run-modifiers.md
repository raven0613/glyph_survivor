# Run Modifiers — Boss Rewards and Glyph-Cell World Rules

> 狀態：本文記錄已確認的單局 Modifier 產品／工程契約。首批內容為 `VOLATILE`、`DISCONNECTED` 與 `OVERLOAD`。本文是 Boss Modifier reward、run-start testing offer、單局 Modifier ownership、Glyph Cell status、Modifier 傷害合成、reaction-chain、presentation 與分階段驗收的唯一詳細入口；跨系統產品意圖仍以 [`spec.md`](../../spec.md) 為準，跨層架構與 Runtime 權威仍以 [`AGENTS.md`](../../AGENTS.md) 為準。

## 1. 定位與非目標

Run Modifier 是玩家在一局內取得、會改寫敵方 Glyph Cell 世界規則的全域 Build 能力。它不是 Weapon Module，也不是 Weapon Instance 的投資：

- Modifier 不占用 Module Slot，不綁定單一 Weapon Instance，也不隨武器替換而消失。
- Modifier 只存在目前 run；回到主選單或建立下一局時必須清空。
- Boss reward 可能在 Weapon／Module Build 尚未成形時出現；每張首版 Modifier 必須單獨提供可理解、可利用的決策，不能要求特定 Weapon、Module、Rank 或另一張 Modifier 才開始生效。
- 不同 Modifier 可以同時存在並互相作用。
- 同一 Modifier definition 在一局內最多取得一次；已持有的 definition 不再進入 eligible reward pool。
- 首版 Modifier 沒有 Rank、重複疊加或覆蓋規則。未來若允許同名 Modifier 再次取得，必須先定義明確 Rank table 或 replacement policy，不能建立兩份相同 Runtime handler 重複觸發。
- Modifier 仍必須透過 Glyph Cell Durability、canonical topology 與 stable Glyph ID 運作，不得建立 Enemy／Boss Entity HP 的第二套傷害模型。
- Modifier presentation 不得決定 target、傷害、status、chain、offer 或 reward 結果。

首批 Modifier 的策略目標是：

- `VOLATILE`：把局部 Cell 死亡轉成可連鎖的同 body 內部結構震盪。
- `DISCONNECTED`：讓玩家先切斷 living topology，再快速清除相對較小的存活團塊。
- `OVERLOAD`：讓單次重擊先建立 `CRACKED` 結構弱點，再由後續 direct attack 消耗。

## 2. 內容與 Runtime ownership

LOADING 準備不可變的 Modifier content：

- stable definition ID；
- UI title／description；
- effect strategy ID；
- 本文定義的具名公式參數；
- reward-pool metadata；
- presentation semantic roles；
- 結構與數值驗證完成的 immutable prepared representation。

所有可調數字只由集中、可驗證的 Modifier content／Runtime config authoring 提供。系統不得散落 `0.35`、`0.75`、`0.80`、`0.60`、`1.40`、`1.60`、`64` 等 magic numbers。本文保存公式、參數名稱、相對關係與目前已同意的 prototype authoring values；實作後的數值 source of truth 是 prepared config。

Runtime 擁有：

- 本局已取得的 Modifier definition IDs；
- domain-separated modifier-offer RNG streams，至少區分正式 `BOSS_REWARD` 與測試 `RUN_START_TEST`；
- pending Modifier offer authorizations，其 source 至少區分 `BOSS_REWARD` 與 `RUN_START_TEST`；
- pending Boss reward tokens；
- active Modifier offer；
- stable offer／choice／reaction-chain IDs；
- Cell status 與 status-specific payload；
- active Volatile chains、current／next waves 與 deferred events；
- topology classification cache 與 Slime reassembly latch；
- diagnostics。

React 只接收 UI-sized immutable summaries，包含active offer的authorization source，並送出最小原子 command。Run-start testing offer不得偽裝成Boss defeat copy；React也不得自行推測source。PixiJS只消費render snapshot中的resolved presentation state。

## 3. Modifier offer 授權與選擇交易

### 3.1 Boss Encounter reward

Boss Modifier reward 的授權單位是 Boss Encounter，不是 split body：

1. Encounter 的所有 Cells 都成為 Husk 後先進入 `COLLAPSING`。
2. 完整 collapse presentation 與該 Encounter 已授權的 Volatile source-event sequence 都完成、Encounter 正式第一次進入 `DEFEATED` 時，Runtime 才建立一次性 Modifier reward token。
3. Root／child bodies、cleanup retry、重複 phase publication 或 React remount 都不得建立第二份 token。
4. Token 必須在 Boss entities cleanup 前複製出所有必要 identity；等待玩家選擇時不需要保留已死亡 Boss entity。
5. Boss 原有 XP reward 與 Modifier reward 是正交獎勵。Modifier 不取代 XP，XP 也不能冒充 Modifier choice。

Modifier offer 遵守：

- 有至少三個 eligible definitions 時，提供三張不同 choices。
- 只剩兩個 eligible definitions 時，允許二選一。
- 首版不定義單張自動取得或零 eligible 的 fallback；目前 Boss schedule／content 必須確保每次 reward 至少仍有兩個 eligible definitions。未來若可能低於兩張，必須先更新本文。
- 已持有 definitions 必須排除。
- choice ID 與 offer ID 穩定且非空。
- 有三個以上 eligible definitions 時，以 run seed 派生的 dedicated `BOSS_REWARD` Modifier RNG、stable content order 與 stable ID tie-break 選出三張；combat、enemy、rendering、XP-upgrade與`RUN_START_TEST` RNG消耗不得改變結果。

選擇使用獨立 transaction：

```text
selectModifier({
  offerId,
  choiceId,
})
```

Runtime 必須重新驗證：

- phase 是 `PAUSED_MODIFIER`；
- command 引用目前 active offer；
- choice 屬於該 offer；
- definition 仍 eligible 且尚未持有；
- 該 offer 引用的 `BOSS_REWARD` 或 `RUN_START_TEST` authorization 尚未消耗。

失敗時不得消耗 offer、不得加入 Modifier、不得恢復 simulation。成功時以單一 transaction 加入 definition ID、重建 disposable resolved Modifier profile、消耗 authorization／offer，然後才決定下一個 paused decision 或回到 `RUNNING`。

### 3.2 Run-start testing offer

Modifier 實作與驗收期間使用一個集中、validated 的 Runtime config flag：

```text
enableRunStartModifierOfferForTesting: boolean
```

它只控制開發測試入口，不是正式獎勵規則：

- `false` 是正式／release path；`startRun` 沿既有流程開始，不建立測試authorization／offer，也不消耗任何test-offer RNG。
- `true` 時，Runtime 在初始 Weapon 已合法選定、WorldState 已建立之後，但在任何 `RUNNING` fixed step、Gameplay time、Weapon equipped time、spawn、cooldown 或 director work 發生之前，建立每局恰好一次的 `RUN_START_TEST` authorization，並直接進入 `PAUSED_MODIFIER`。非法初始Weapon仍留在`READY`，不得先建立authorization。
- 測試 offer 使用同一套 eligible pool、owned-definition exclusion、stable offer／choice IDs、三選一／二選一規則與 `selectModifier` transaction；不得建立 bypass command 或直接把 definition 塞進 WorldState。若eligible definitions超過顯示數量，抽選使用由run seed獨立派生的`RUN_START_TEST` RNG domain；它不得推進正式Boss Modifier offer RNG。現在三張全列時依stable content order建立choices，不需要消耗亂數。
- 目前三個 definitions 都未持有時，開局測試 offer 顯示三張。選定後正常加入 owned set。
- `RUN_START_TEST` 不建立或消耗 Boss reward token、不發 XP，也不計為擊敗 Boss。之後 Boss Encounter 正式進入 `DEFEATED` 時仍正常建立一次 `BOSS_REWARD` authorization，並依當下 eligible count 提供 N 選一；以目前三張首批內容而言，開局已持有一張後，Slime reward 會自然成為二選一。
- `READY → PAUSED_MODIFIER → RUNNING` 的測試路徑在任何 simulation step 前完成，視為初次開局而非從 Gameplay pause 恢復，因此 commit 後不授予 resume invulnerability。
- Flag 必須在 LOADING／GameHost initialization 驗證為 Boolean，並對該局凍結；不得在 run 中途切換、不得放進玩家存檔，也不得由 React 或 query string 直接改寫 Runtime state。
- Return-to-menu／run teardown完整清除test authorization、offer origin、consumed guard與owned Modifiers；prepared Host flag可以保留。New run會重新依當時凍結的config決定是否建立一次測試authorization；reset、重複`startRun`、React remount或stale command都不得在同一run建立第二次。

當同一 fixed step 同時產生多種終止／決策結果時，首版優先序為：

```text
PLAYER_DIED
→ MODIFIER_REWARD
→ XP_UPGRADE
```

若 Modifier commit 後仍有下一個 Modifier reward 或 pending XP upgrade，直接進入下一個 paused decision，不得短暫恢復 `RUNNING`。

## 4. 完整暫停與 lifecycle

每個 Runtime-authorized Modifier offer 都使用獨立 `PAUSED_MODIFIER` phase；正式流程由 Boss reward 授權，測試流程可由第 3.2 節的 run-start flag 授權。它和 `PAUSED_MENU`、`PAUSED_UPGRADE` 同屬完整 Gameplay pause：

- fixed simulation steps、Gameplay time、cooldowns、projectiles、enemy movement、damage、Volatile waves、drops、XP、status duration 與 director 全部凍結；
- React DOM animation 可以使用獨立 UI clock；
- 暫停 overlay 開啟時清除或忽略已按住的 Gameplay input；
- 只有已經跑過 `RUNNING` simulation 的 run 在整個 decision chain 結束、phase 真正回到 `RUNNING` 時，才依共用 pause-resume 契約授予一次 resume invulnerability；run-start testing offer 屬初次開局例外，不授予；
- Modifier／Upgrade 之間不得短暫進入 `RUNNING`，也不得重複授予 invulnerability。

玩家死亡後不得繼續套用尚未提交的 Modifier damage。`DEATH_REVIEW` 可以保留已存在的 rendering-only presentation，但 active Volatile damage queues、pending status application 與未授權的 Boss Modifier reward 不得產生新的 damage、statistics、kill、XP 或 reward mutation。這種 run termination 不屬於「因同幀效能預算不足而丟棄事件」。

## 5. 共同 Damage Application 契約

首批 Modifier 需要一個 Runtime-owned 的共同 durability commit boundary。Immediate direct、Damage Spread、topology-transfer arrival 與 Modifier secondary damage 都必須產生明確的 Damage Application outcome，不能讓不同系統各自直接扣耐久而漏掉 status／Husk transition。

每次 application 至少保留：

- stable damage application ID；
- root attack event ID；
- reaction-chain ID 或 `null`；
- source route；
- source Weapon Instance ID 或明確的 non-weapon source；
- target Glyph ID；
- base direct damage；
- Modifier bonuses；
- resolved effective damage before overkill clamp；
- actual applied Durability delta；
- previous／next Glyph state。

首版 route 至少分成：

```text
DIRECT_LOCAL
DIRECT_TRANSFER_ARRIVAL
DAMAGE_SPREAD
VOLATILE_SECONDARY
```

`DIRECT_TRANSFER_ARRIVAL` 直到 topology pulse 抵達才建立 application、判斷 DISCONNECTED／CRACKED／OVERLOAD、修改 Durability 與記錄 statistics。排程 pending transfer 時不得提前消耗 status 或推測未來 multiplier。

任何 application 都必須：

- 對同一 target 在該 application scope 只提交一次 Durability mutation；
- clamp 並使用共用 Gameplay precision normalization；
- 只以實際 `Living → HUSK` transition 發出 Husk transition outcome；
- 對既有 Husk 回傳零 damage，且不建立第二次 death／explosion；
- 以 actual applied delta 記錄 damage statistics，排除 overkill。

由玩家攻擊直接或間接造成的 Modifier damage，首版仍歸屬 causal root Weapon Instance 的 total damage；Runtime 可另外記錄 per-Modifier diagnostics，但不能讓同一 actual delta 在 weapon total 中重複計算。

## 6. Glyph Cell status

Glyph life state 仍只有：

```text
HEALTHY → DAMAGED → HUSK
```

`CRACKED`、Slime 的 disconnected latch 與未來 Fire／Ice／Corrosion 等是正交的 status，不得塞進 `GlyphCellState`。

狀態儲存採混合模型：

- typed status bit flags：快速表示多個 Boolean statuses；
- status-specific payload：只保存需要 multiplier、duration、stack、source 或 episode ID 的狀態。

不要為每顆 Cell 建立 generic `Map<statusId, object>`、動態陣列或 closure。系統必須透過具名 API 操作，例如：

```text
applyCracked
consumeCracked
setDisconnectedLatch
clearDisconnectedLatch
clearStatusesOnHusk
```

首版 payload：

- `CRACKED`：只有一個 active charge，並保存建立它的 root attack event ID；不需要 duration／stack。
- `DISCONNECTED_LATCHED`：保存 multiplier 與 reassembly episode identity。

Status 跟隨 stable Glyph ID 經過 morph、split 與 owner transfer。進入 Husk 時清除不再有意義的 living-only statuses；cleanup／pool reuse 必須完整 reset flags 與 payload。

## 7. 共同 Modifier 合成順序

每個 direct attack event 或 topology-transfer arrival：

1. 凍結涉及 owner 的 living canonical-topology snapshot，以及本事件開始時已存在的 `CRACKED` snapshot。
2. 完成既有 direct／spread claim dedup；同一 attack event／Glyph 仍只保留合法的最高 claim，direct 與 spread 的既有優先規則不變。
3. 對 direct Damage Targets 計算 DISCONNECTED multiplier 與既有 Crack bonus。
4. 每個 target 只提交一次 final direct damage。
5. 收集 actual damage outcomes、Husk transitions 與 qualifying Overload sources。
6. 消耗本事件開始時已存在且成功參與 direct damage 的 Crack。
7. 整批 direct targets 完成後，dedup 並施加新 Crack；新 Crack 不得回頭增傷同一 root attack event，包括該 event 之後才抵達的 pending topology transfers。
8. Husk transitions 建立或加入 Volatile reaction chain。
9. Volatile 依 wave scheduler 在目前或後續 fixed steps解析。
10. 相關 Volatile chains 收斂後，才允許仍有 Living Cells 的 owner 執行 topology structural commit 或 Slime split／reassembly。全 Husk owner／Encounter 仍依既有契約立即進入 `COLLAPSING`，但正式 reward／cleanup 必須等待 Runtime-owned pending explosion sequence完成。

Modifier bonus 不互相遞迴放大。令：

```text
D = base Direct Damage
M = DISCONNECTED multiplier；不符合時為 1
C = 本事件開始時已有 CRACKED 時為 0.40，否則為 0
```

則：

```text
Final Direct Damage
= D
  + D × (M - 1)
  + D × C

= D × (M + C)
```

因此：

- 只有 Crack：`D × 1.40`。
- 只有最大 DISCONNECTED：`D × 1.60`。
- 兩者同時達到各自最大效果：`D × 2.00`。

不得改成 `D × 1.60 × 1.40 = D × 2.24`。Final Direct Damage 可以協助達到 OVERLOAD threshold，形成受控互動；但新 Crack 延後到下一個 attack event，因此不會在同一事件內遞迴。

## 8. VOLATILE — 不穩定結構

### 8.1 Gameplay identity

Cell 第一次由 Living 進入 Husk 時，產生一次同 body 的結構爆裂：

```text
Living Cell enters HUSK
→ enqueue one Volatile explosion
→ explosion damages immediate living topology neighbors
→ newly Husk neighbors enqueue their own explosions
→ continue in breadth-first waves until no new Husk transition remains
```

首版是「內傷」而非跨怪爆炸：

- 只查詢觸發當下同 owner 的 canonical topology。
- 只包含 topology distance `1` 的四方向 immediate neighbors。
- 對角線不算。
- 不讀 world-space 距離、Body Motion、deformation 或 knockback。
- 原本就沒有 canonical adjacency 的 authored floating Cell 不會因畫面接近而被傳到。
- 不跨 owner。

未來跨-owner 強化是獨立能力軸，必須新增明確的 world-space radius 與 cross-owner spatial query；不得把 `topologyDepth = 1` 偷換成 world-unit radius。

### 8.2 Explosion damage

令：

```text
sourceMaxDurabilityRatio = prepared VOLATILE content parameter
maximumExplosionDamage = prepared VOLATILE content parameter
```

每個 Living neighbor 承受：

```text
Explosion Damage
= min(
    sourceMaxDurabilityRatio × Dead Source Cell Max Durability,
    maximumExplosionDamage
  )
```

已同意的首版 prototype authoring values 為：

```text
sourceMaxDurabilityRatio = 0.35
maximumExplosionDamage = 0.75
intraOwnerTopologyDepth = 1
```

這些數字必須由 config authoring／preparation 提供，不能複製進 damage system。

Explosion Damage：

- 只作用於 resolution 當下仍 Living 的 target；
- 不傷既有 Husk；
- 不使用 Husk directional topology transfer；
- 不附帶原攻擊的 Damage Spread；
- 不取得 DISCONNECTED multiplier；
- 不消耗 `CRACKED`；
- 不觸發 OVERLOAD；
- 不繼承原攻擊的 Material impulse、primary hit particles 或 whole-body knockback；
- 可以使 target 進入 Husk並繼續 VOLATILE chain。

同一 explosion event 內，同一 target 最多受傷一次。不同 Dead Source Cells 的 explosions 是不同 secondary applications，可以依穩定順序分別命中同一 Living Cell；這是多點引爆與密集結構玩法的一部分。

### 8.3 Causal identity 與 dedup

同一 root damage commit 對同一 owner 造成的初始 Husk transitions 共用一條 reaction chain。Topology-transfer arrival 在真正抵達並提交 damage 時才建立自己的 reaction chain。Volatile descendants 繼承 parent chain ID。

每個 Glyph 只能第一次進入 Husk，因此首版採更強的不變量：

> 同一 Glyph 整局最多產生一次 Volatile explosion，並歸屬於真正使它進入 Husk 的 causal chain。

若不同 chains 在同一 fixed step 都可能傷害同一 Living Cell，以 stable chain ID、source Glyph ID 與 application ID 決定提交順序。第一個造成 `Living → HUSK` 的 chain 取得其 explosion；後續 applications 看到 Husk後不再造成 damage 或 explosion。

### 8.4 Wave scheduler 與 processing budget

Volatile 沒有 hard per-chain explosion cap。有限 Glyph 數與每 Glyph 一次 Husk transition保證 chain 自然終止。

`maxExplosionResolutionsPerFixedStep` 是全世界每個 fixed step 可解析的 explosion-event processing budget，不是「第 65 個事件被刪除」的 Gameplay 上限。已同意的 prototype authoring value 為 `64`；實機 profiling 若顯示 simulation p95 或可讀性需要更低值，可以在 config 中降低，但該值在一局開始時必須凍結，不能依即時 FPS 自動改變。

每條 chain 保存：

```text
currentWave
nextWave
```

規則：

1. Active chains 依 stable chain ID，以可重現且不永久餓死後來 chain 的 stable round-robin cursor 消費全域 budget。
2. Chain 內同一 wave 的 source events 依 stable Glyph ID 排序。
3. 一個 fixed step 全世界最多解析 `maxExplosionResolutionsPerFixedStep` 個 source explosion events；budget 計 source events，不計每個 source 命中的 target 數。
4. 當步 explosions 新造成的 Husk 一律加入該 chain 的 `nextWave`。
5. 即使當步仍有剩餘 budget，也不得在同一步解析該 chain 的 `nextWave`。
6. 若 `currentWave` 自身超過當步可取得的 budget，未處理 events 保留到後續 fixed steps，不得遺失、合併成假 AoE 或提早套用 damage。
7. `currentWave` 完全清空後，最早於下一個 fixed step 才將 `nextWave` 升為新的 current wave。
8. 完整 Gameplay pause 凍結 wave queues、scheduler cursor 與 presentation time。
9. Pool 容量不足時可以記錄 pool miss 並使用安全 fallback allocation；不得因 pool／particle／frame budget 丟棄 authoritative explosion。

較低 processing budget 會延長波浪傳播時間，並可能因其他 attack events 在波與波之間介入而改變戰鬥結果。因此它是凍結於 run 的 Gameplay timing config，不是可在同一 run 內自動降級的純 presentation knob。

### 8.5 Structural boundaries

只要仍有 Living Cells 的 owner 存在尚未解析、仍可能造成 damage 的 Volatile events：

- topology dirty state 必須保留，不能被 Slime split system讀取後提前清除；
- canonical layout／ownership structural commit 必須延後；
- 只延後該 affected owner 的 structural commit，不能阻塞無關 owner。

如果 owner 已沒有 Living Cells，它仍依既有生命週期契約立即失去 targeting、damage reception與combat／player-contact collision資格，並進入 `COLLAPSING`；若是仍有其他Boss bodies存活的depleted Slime body，則沿用既有`INACTIVE`規則。首版Volatile不跨owner，因此該owner剩餘explosion events已不可能找到Living damage target，但Runtime仍須依wave順序解析其source events與必要presentation，不能因owner depleted就直接丟棄。

若 owner 仍有 Living Cells，正常 movement、Body Motion、collision 與其他 combat 可以繼續；canonical topology本身在相關 chain 收斂前保持不變。其他 attack events仍可造成新的 Husk／chains，所有結果依 stable event order解析。

Boss Encounter在所有Cells成為Husk時仍立即進入`COLLAPSING`。Encounter只有在既有collapse presentation完成，且屬於該Encounter的pending Volatile source events全部解析後，才可進入`DEFEATED`、發放Modifier／XP reward與cleanup。這是collapse完成條件的Runtime擴充，不是新增另一套死亡狀態。

### 8.6 Presentation — topology domino

VOLATILE 的核心視覺是短促、離散、沿 canonical topology 接棒的 shock，不是 world-space 爆炸圈：

- 每個實際解析的 source explosion 都產生一個不可省略的核心 pulse。Source Husk 先快速內縮／夾緊，在一個清楚的頓點後，以括號、短橫或直線等 ASCII overlay 向其四方向 immediate topology neighbors 做一次短促釋放。
- 本波實際受影響的 neighbors 在 damage commit 時各自做一次輕量 topology-axis jolt；新進入 Husk 的 Cell 只在它成為下一波 source、該 source event 真正解析時才播放自己的釋放。
- 同一 breadth-first wave 的 sources 同時呈現；不同 wave 依 authoritative resolution 順序出現。前一波可以留下極短、快速衰減的 afterimage，使 `A → B → C → D` 的 leading edge 可讀，但不能拖成持續 glow 或提前顯示下一波死亡。
- 不畫圓形 shockwave、連線、beam 或 source-to-target path。這讓它和 OVERLOAD 的單次徑向衝擊，以及既有 topology-transfer 的低強度逐 Cell brightness pulse 保持不同語法。
- 每個 core source pulse 使用 stable event ID 與 pooled atlas particles；可選的附加碎屑／glow可以依 visual budget 降級，core pulse、wave order與resolved source identity不能丟棄。
- `maxExplosionResolutionsPerFixedStep` 不是動畫速度旋鈕。線性 chain 每波只有一個 source 時，降低該 budget不會自然產生更大的逐格間隔；首版先用短 attack／hold／settle cadence與pulse尾跡取得可讀性，不能用renderer負載改變authoritative wave timing。

## 9. DISCONNECTED — 結構失聯

### 9.1 Living component

DISCONNECTED 只使用已 commit 的 canonical topology：

- graph nodes 只包含 `HEALTHY`／`DAMAGED` Cells；
- Husk 保留完整 outline 身分，但不連接 living graph；
- adjacency 使用四方向 canonical neighbors；
- Body Motion、deformation、knockback 與畫面距離完全不影響 component；
- authored floating Cells 正常形成自己的 components，不取得內容豁免。

首版不實作：

- living neighbor-count threshold；
- authored core reachability；
- bridge／articulation／細弱連接；
- 依視覺距離推測孤立。

這些只能作為未來明確強化加入，不能在首版 classification 中隱藏。

### 9.2 Protected major components

令：

```text
componentSize = 該 Living component 的 Cell 數
largestComponentSize = 目前 owner 最大 Living component 的 Cell 數
protectedComponentRatio = prepared DISCONNECTED content parameter
```

若：

```text
componentSize / largestComponentSize >= protectedComponentRatio
```

該 component 視為主要團塊，不取得傷害加成。恰好等於 threshold 仍受保護；比較不得以 UI rounding 決定。

已同意的首版 prototype authoring value：

```text
protectedComponentRatio = 0.80
```

因此多個接近同樣大的 components 可以同時受保護。單一 component 的一字／兩字怪自然是 `×1.0`；兩個同樣大小、彼此不連接的 components 也都屬最大團塊而受保護。

### 9.3 Damage multiplier

對未受保護的 component：

```text
R = componentSize / ownerTotalLivingCellCount

Disconnected Multiplier
= min(
    maximumDamageMultiplier,
    1 + isolationBonusScale × (1 - R)
  )
```

已同意的首版 prototype authoring values：

```text
isolationBonusScale = 0.60
maximumDamageMultiplier = 1.60
```

`ownerTotalLivingCellCount` 與所有 component sizes 使用該次authoritative damage batch第一次Durability mutation前的topology snapshot。Immediate direct targets共享原始attack event的pre-mutation snapshot，避免同一batch內的Cell迭代順序改變倍率。Topology-transfer arrival在真正抵達時建立新的arrival-time snapshot；它是延後提交的direct application，可以觀察抵達當下已commit的topology。

Multiplier 只作用於實際的 direct Damage Target：

- DamageShape 內立即承受 direct damage 的 Living target；
- topology-transfer pulse 抵達時仍合法、實際承受 reserved direct damage 的 Living target。

它不作用於：

- Husk Impact source；
- topology pulse 的中間 path Cells；
- Damage Spread-only targets；
- Volatile Explosion targets；
- 只播放 Material response 的 Impact Cells。

同一immediate damage batch先凍結topology，再為該batch所有direct targets計算multiplier；該batch本身新產生的Husk切口不會回頭改變同batch其他target。之後才抵達的pending topology transfer則以arrival-time snapshot判定，不沿用數個fixed steps前的component multiplier。

### 9.4 Slime split／reassembly latch

Slime 的 topology destruction、Volatile chains 與 structural commit 依以下順序：

```text
damage events
→ drain all related Volatile chains
→ calculate final pre-split Living components
→ snapshot DISCONNECTED multipliers
→ split / compact / reassembly structural commit
```

對這次 pre-split snapshot 中未受保護的 Cells：

- 將 multiplier 與 reassembly episode ID 保存成 `DISCONNECTED_LATCHED` status payload；
- payload 跟隨 stable Glyph ID 經過 owner transfer與新 layout；
- `REASSEMBLING` 期間的合法 direct attacks使用 `max(latchedMultiplier, currentTopologyMultiplier)`；
- owner 正式回到 `ACTIVE` 時清除本 episode latch，之後重新依最新 canonical topology判定；
- 若 reassembly 期間再次發生合法 topology destruction，新的 classification與既有 latch取較高 multiplier，直到該 reassembly episode結束；
- Cell 進入 Husk時清除 latch。

這讓玩家有「切開 → 在重新聚合期間清除小塊」的操作窗口，同時不使用暫時被擊飛後的畫面距離假裝 topology 失聯。

### 9.5 Presentation — unstable fragment

DISCONNECTED 不使用明顯爆光或獨立範圍特效；它讓玩家從團塊動態讀出脆弱程度。對實際 multiplier `M` 定義 presentation severity：

```text
severity =
  clamp(
    (M - 1) / (maximumDamageMultiplier - 1),
    0,
    1
  )
```

- Protected component 的 severity 為 `0`，不顯示易傷提示。Runtime／bridge 提供 component identity、membership或已解析的per-Glyph presentation values與severity；renderer不得重新搜尋topology或從畫面距離猜測團塊。
- 平常時，vulnerable component 的 Cells 從 canonical component centroid 向外做非常輕微、上限受config限制的render-only spacing loosen。這不改變authoritative anchor、hitbox、canonical adjacency或DISCONNECTED判定。
- Ambient instability採低duty-cycle的短促micro-burst：大部分時間保持安靜，偶爾由stable component／Glyph identity產生小幅不同步jitter與rotation drift；不得用每幀亂數、持續正弦抖動或長時間震顫把整個Boss變成果凍。
- Vulnerable direct target受擊時，先讓該component做一次共同方向、短attack的整體震動，再疊較小的per-Glyph dephased residual。Severity越高，振幅與鬆動程度越高；其他Cells只取得render-only結構反應，不取得primary hit flash、Material impulse或damage。
- 更強的primary hit、OVERLOAD或VOLATILE transient開始時，可短暫壓低DISCONNECTED ambient motion，避免多個shake頻率互相污染；status本身與damage multiplier不受影響。
- 所有phase、ambient staggering與hit episode使用simulation presentation time並在完整Gameplay pause凍結。

## 10. OVERLOAD — 耐久過載

### 10.1 Trigger

OVERLOAD 只由成功提交的 direct damage觸發：

- `DIRECT_LOCAL`；
- `DIRECT_TRANSFER_ARRIVAL`。

Damage Spread與Volatile Explosion不觸發。

令：

```text
resolvedFinalDirectDamage =
  套用既有 Crack／DISCONNECTED bonus後、
  overkill clamp前的 Final Direct Damage

overloadThresholdRatio =
  prepared OVERLOAD content parameter
```

若 target 本次 actual applied Durability delta 大於零，且：

```text
resolvedFinalDirectDamage / target.maxDurability
>= overloadThresholdRatio
```

則 target 成為一個 Overload source。已同意的首版 prototype authoring value：

```text
overloadThresholdRatio = 0.60
```

使用 overkill clamp 前的 final damage，確保判定不被 target 剩餘 Current Durability 間接改寫。

### 10.2 Crack application

每個 qualifying source 對事件開始時 canonical topology distance `1` 的 immediate neighbors嘗試施加 `CRACKED`：

- 只施加給整批 direct damage完成後仍 Living的 neighbor；
- 對角線不算；
- source即使被該次重擊打成 Husk，仍可依本事件 topology snapshot施加 Crack；
- 同一 event 中多個 Overload sources指向同一 target時，只得到一個 active Crack；
- 已經 CRACKED 的 Cell 再次收到 application是 no-op，不疊層、不刷新 duration；
- Crack沒有 duration，但保存 `createdByRootAttackEventId`；
- Crack application本身不造成 damage，不建立 Damage Application，不觸發其他 Modifier。

所有 immediate direct targets完成、舊 Crack消耗後才批次施加新 Crack。Direct application只有在自己的root attack event ID不同於`createdByRootAttackEventId`時才能消耗該Crack；因此同一攻擊之後才抵達的topology transfer不會立刻吃掉自己建立的弱點。若target在本事件開始時已有較舊Crack、這次消耗後又被另一個Overload source重新施加，事件結束時可以保留一個帶有目前root attack event ID的新Crack，供下一個不同attack event使用。

### 10.3 Crack consumption

下一次對 CRACKED Cell成功提交的 direct damage：

```text
crackDamageMultiplier = prepared OVERLOAD content parameter
Cracked Direct Damage = base Direct Damage × crackDamageMultiplier
```

已同意的首版 prototype authoring value：

```text
crackDamageMultiplier = 1.40
```

在共同 bonus composition中，Crack貢獻相對於 base Direct Damage的 `+0.40 × D`，不乘上 DISCONNECTED bonus。若target在commit前已失效、已是Husk、沒有實際direct damage application，或application仍屬於建立此Crack的同一root attack event，Crack不消耗。其他合法direct application提交時只消耗一個charge。

Crack bonus可以協助該次 attack達到 OVERLOAD threshold，也可以使 Cell進入 Husk並觸發 VOLATILE；新 Overload Crack仍延後到下一個 event，因此不會同事件遞迴。

### 10.4 Presentation — impact compression and cracked surface

OVERLOAD 的視覺語法是「單發重擊在一個頓點內向外卸力」，不是逐格傳導：

- Qualifying direct hit提交時，主目標沿snapshotted attack／impact axis做一次短促非等比壓縮：快速squeeze、極短hold、乾脆rebound。只縮放整體而沒有方向性的普通hit pulse不足以表達OVERLOAD。
- 同時由主目標向world space周圍釋放一次很短的徑向ASCII／punctuation shockwave。它可以連續向外擴張，但只有一次，不沿topology逐Cell接棒，也不代表額外damage target。
- 整批direct damage完成後，實際取得`CRACKED`的Living neighbors切換成persistent cracked-surface presentation：同一字元視覺上分成二至三個貼近原中心的碎片，每片保留同一appearance palette並只有很小、theme-defined的brightness gain差異。裂片位移／rotation有上限，不能讓一顆authoritative Cell看成數顆敵人或改變hitbox判讀。
- Printable ASCII glyph在LOADING時已建立共用atlas。首版cracked surface使用同一atlas source預製／編譯可重用fragment frames，並以stable Glyph ID選pattern、以pooled particles呈現；不得在hit時逐Cell rasterize `Text`、建立dynamic texture、套per-Cell filter／mask或建立Container。細瘦字元若無法形成三個有效alpha fragments，prepared atlas必須使用二片或validated fallback pattern。
- `CRACKED`被合法direct hit消耗時，裂片presentation由該次hit的短促release／primary feedback接手；若Cell進入Husk則收斂成既有Husk silhouette，不能把living-only Crack碎片誤當成collapse debris移除完整輪廓。
- 若future profiling顯示多片particles在stress population成本過高，才考慮一個quad的custom particle shader／batcher；不得先以每Cell filter render pass換取原型方便。

## 11. Interaction matrix

| Damage／effect source | DISCONNECTED bonus | Consume existing Crack | Trigger OVERLOAD | Husk transition triggers VOLATILE |
| --- | --- | --- | --- | --- |
| Local direct | Yes | Yes | Yes | Yes |
| Topology-transfer arrival | Yes, evaluated at arrival | Yes, at arrival | Yes, at arrival | Yes |
| Damage Spread | No | No | No | Yes |
| Volatile Explosion | No | No | No | Yes |
| Overload Crack application | No damage | No | No | No |

既有 attack-event dedup仍先於 Modifier：

- 一道 Cone stream內部取樣共享 event，不能重複套 Modifier bonus。
- Projectile Count產生的不同 Cone streams是獨立 attack events，可以各自合法命中、消耗當時存在的 status與建立 chain。
- 同一 event中 direct與spread重疊仍只保留合法最高 claim；只有最終 route為direct的 application才套用 DISCONNECTED／CRACKED／OVERLOAD。
- Modifier secondary damage不得自動生成Damage Spread或再次複製原始DamageShape。

## 12. Presentation contract

### 12.1 Shared motion language

所有 Modifier 動畫共同採用「有頓點、有巧勁、迅速收乾淨」的節奏。每個主要 profile 都以具名、validated config 分開保存：

```text
attackDurationMs
holdDurationMs
settleDurationMs
```

- `attack` 快速建立方向與力量；`hold` 是極短、清楚可讀的頓點；`settle` 迅速回收，不拖成長尾。
- 一個動作最多使用少量明確 beats。不得以長時間blur、持續glow、無止境sine shake、慢速漂浮或大量ease-in／ease-out取代impact。
- Persistent cue也必須由「靜止占大多數＋短促micro-burst」組成；常駐狀態不等於每一幀都在動。
- Exact durations、easing／step curve、amplitude、tint、alpha、brightness gain、overlay characters、duty cycle與suppression priority只存在集中、prepared combat visual theme的Modifier semantic roles；Modifier gameplay content不複製另一組presentation literals。
- 完整Gameplay pause凍結所有Modifier presentation age／phase；renderer不得讀wall clock讓ambient或afterimage在暫停中繼續老化。

### 12.2 Bounded presentation channels

未來多種Cell statuses透過固定通道合成，而不是把任意數量的filters、tints與shakes相乘：

```text
Base Appearance
+ Persistent Motion
+ Persistent Surface
+ Transient Deformation
+ Event Overlay
```

- DISCONNECTED主要占用`Persistent Motion`；`CRACKED`占用`Persistent Surface`；OVERLOAD命中占用`Transient Deformation`與一次`Event Overlay`；VOLATILE只使用Runtime-authorized `Event Overlay`。
- 每個channel有明確priority、clamp與同時可見上限。Motion amplitudes不得無限制相加，surface variant不得建立無界overlay list，tint也不能成為唯一識別訊號。
- Render snapshot攜帶bounded resolved values或semantic role＋必要的simulation-time identity，不把每顆Cell的generic status list或mutable payload交給PixiJS。
- Modifier feedback不得覆寫 creature Appearance Profile、永久改變 Material或讓Husk離開完整輪廓。

### 12.3 Authority and readability

Modifier 必須可讀，但 presentation 不是權威狀態：

- `CRACKED` Cell需要可辨識、低於玩家攻擊核心的結構弱點幾何；碎片間的微小亮度差只是輔助，不能成為唯一提示，也不能暗中建立Gameplay duration。
- DISCONNECTED latch可以顯示結構失聯／易傷提示，但不得以畫面距離決定 multiplier。
- Volatile每個實際解析的 source explosion必須提供核心可讀的ASCII／Glyph feedback；非必要附加粒子可以依品質設定降級，但不能省略 authoritative wave順序或讓尚未套用 damage的下一 wave提前顯示死亡結果。
- Renderer只消費 resolved status／event summaries，不得搜尋topology、推進queues、選target、計算公式或提交damage。

## 13. Performance 與 diagnostics

至少追蹤：

- active Modifier definition IDs；
- active Volatile chain count；
- current／next wave event count；
- per-step resolved與deferred explosion count；
- maximum observed wave depth；
- explosion target candidate／applied／skipped-Husk counts；
- Volatile scheduler pool misses；
- owners whose structural commit is deferred by active chains；
- DISCONNECTED topology-cache rebuild count與time；
- protected／vulnerable component counts；
- active Cracked與latched status counts；
- Crack applications、dedup、consumptions；
- Overload threshold evaluations與success count；
- active／peak cracked fragment particle count、fragment-atlas source count與status-overlay pool misses；
- active／peak Modifier core event overlays、optional particle count、optional visual-budget suppressions與effect-pool misses；
- Modifier damage actual delta，並保留 causal Weapon Instance attribution；
- Modifier offer RNG／eligible count／two-card fallback count。

不得以降低damage accuracy、丟棄queued explosion、提前完成collapse／進入`DEFEATED`、略過status或縮小topology query來換取frame time。可降級的只有非必要presentation粒子、附加glow與其他renderer-owned裝飾。

VOLATILE processing budget、component analysis與status hot path必須可headless測量。DISCONNECTED cache只在Living topology或structural ownership／layout真正改變時invalid；Body Motion、deformation與root knockback不invalid。

Rendering stress至少量測既有Desktop-first normal／stress Glyph populations下的`25%／50%／100%` visible Living Cells為`CRACKED`、每fixed step解析到config上限的Volatile source events、以及三個Modifiers同時存在的情況。Cracked fragments與short-lived overlays使用共享atlas source、`ParticleContainer`或經profiling證明的等價batch path和object pools；不得以每Cell filter／mask／dynamic texture作為首版baseline。

## 14. 必要驗證

風險導向的純規則／integration tests至少覆蓋：

- validates `enableRunStartModifierOfferForTesting` as a frozen Boolean config and produces zero offer／authorization／RNG side effects when it is false
- creates exactly one `RUN_START_TEST` authorization after a valid initial Weapon but before the first fixed step when the flag is true
- publishes the authoritative `RUN_START_TEST` offer origin without presenting it as a defeated-Boss reward
- keeps Gameplay time, cooldowns, equipped time, spawning, director work, and damage at zero while the run-start offer is pending
- rejects invalid initial Weapons, repeated `startRun`, React remounts, stale commands, and reset re-entry without duplicating the run-start authorization
- commits the run-start choice through the normal transaction, marks it owned, consumes no Boss token, advances no Boss-offer RNG, and grants no resume invulnerability
- still authorizes the later Boss reward normally and, with the current three definitions, offers the two remaining unowned choices
- authorizes exactly one Modifier reward only after Boss Encounter reaches `DEFEATED`
- keeps Boss XP reward separate from the Modifier reward
- excludes already-owned Modifier definitions from later offers
- offers three unique choices when possible and two when exactly two remain
- produces the same Modifier offer from the same seed and eligible state
- rejects stale, replayed, unknown, or already-owned Modifier commands without consuming the offer
- keeps gameplay fully paused through Modifier selection and queued XP upgrade decisions
- resumes only once after the complete decision chain
- preserves `PLAYER_DIED > MODIFIER_REWARD > XP_UPGRADE`
- routes every immediate and transfer-arrival durability change through one Damage Application outcome
- emits one Volatile explosion only for the first `Living → HUSK` transition
- never explodes an already-Husk Cell again
- damages only same-owner immediate canonical neighbors in first-pass VOLATILE
- uses the dead source Cell's Max Durability in the configured capped explosion formula
- lets different source explosions damage the same still-Living target in stable order
- lets Volatile-caused Husk transitions enqueue the next breadth-first wave
- never resolves a chain's next wave in the same fixed step
- defers events beyond the per-step processing budget without dropping or applying them early
- freezes Volatile queues during complete gameplay pause
- delays only affected living-owner Slime structural commits until related damage-capable Volatile chains settle, while depleted owners enter `INACTIVE`／`COLLAPSING` immediately and wait only for source-event completion before `DEFEATED`／reward／cleanup
- removes targeting and combat collision immediately when a depleted owner waits only for pending reactions
- classifies DISCONNECTED from canonical Living components regardless of deformation distance
- protects every component at or above eighty percent of the largest component
- applies the configured component-ratio multiplier only once to direct Damage Targets
- naturally leaves one-component one-letter and two-letter bodies at `×1.0`
- includes authored floating Cells in normal component classification
- evaluates remote direct DISCONNECTED only when the pulse arrives
- keeps newly severed components from benefiting until the next direct event
- carries the Slime disconnected multiplier through owner transfer and reassembly
- clears the Slime latch when the reassembly episode returns to `ACTIVE`
- triggers OVERLOAD from final direct damage divided by Max Durability, not remaining Durability
- applies no damage when adding Crack
- deduplicates multiple Crack applications to one active charge
- consumes existing Crack exactly once on the next successful direct application
- prevents a newly applied Crack from amplifying the same attack event
- composes maximum DISCONNECTED and Crack as `×2.00`, not `×2.24`
- excludes Spread and Volatile from DISCONNECTED, Crack consumption, and OVERLOAD
- still lets Spread and Volatile Husk transitions start or continue VOLATILE
- attributes actual Modifier-caused damage once to the causal Weapon Instance
- preserves deterministic outcomes under stable event order and a fixed processing budget
- keeps DISCONNECTED ambient mostly still, freezes its deterministic cadence on complete pause, and scales resolved motion severity from the actual multiplier without changing authoritative positions
- presents OVERLOAD as one directional compression／radial event and CRACKED as bounded pooled fragments without per-Cell Text, filters, masks, or runtime texture creation
- presents every resolved Volatile source as one core pulse, preserves same-wave simultaneity／cross-wave order, and never substitutes a radial ring or source-to-target line
- resolves simultaneous status visuals through bounded presentation channels and fully resets every pooled role／phase／fragment on reuse

## 15. Implementation acceptance slices

建議分六次驗收。第1次專門驗收共用offer／lifecycle骨架，確定開局選擇入口可靠；第2～4次各自交付一張可從run-start testing offer選到、Gameplay與核心特效同時完成的Modifier垂直切片。不能先把三張Gameplay都做完、最後才一次補全部特效。

| 驗收 | 交付範圍 | 玩家驗收重點 |
| --- | --- | --- |
| 1. Offer／Runtime foundation | Modifier definitions、owned set、authorization source、`PAUSED_MODIFIER`、原子command、domain-separated RNG、reset／dispose，以及`enableRunStartModifierOfferForTesting` | Flag開啟後，選完初始武器便在第一個fixed step前看到三張Modifier；Flag關閉完全走舊流程；選擇後立即正常開局且沒有額外resume invulnerability |
| 2. OVERLOAD vertical slice | 共用Damage Application boundary、status flags／payload、Overload threshold、Crack消耗、非等比壓縮、短徑向shock與prepared fragment atlas／pool | 重擊有「壓縮—頓點—回彈」；鄰居裂字清楚但仍看成原Cell；下一個不同direct event只加成／消耗一次 |
| 3. DISCONNECTED vertical slice | Living component cache、80%保護、倍率公式、direct-target snapshot、severity、spacing loosen、ambient micro-burst與component hit shake | 切出小團塊後，不看數字也能辨識脆弱程度；受擊是整塊短震而非爆光；畫面鬆動不改hitbox或被擊退後的判定 |
| 4. VOLATILE vertical slice | Husk transition outcome、reaction-chain IDs、breadth-first queues、每步budget、stable fairness、same-owner topology damage與domino core pulses | 能看清快速`A → B → C → D`接棒；同wave分支同時發生；沒有圓形波、沒有丟事件、暫停不偷跑 |
| 5. Slime／Boss production flow | Volatile structural defer、Disconnected reassembly latch、Encounter collapse／DEFEATED、XP coexistence、正式Boss N選一與decision priority | 開局測試選一張後，Slime仍正常給剩餘二選一；分裂／重組增傷窗口正確；Boss不重複發獎或提前cleanup |
| 6. Combination／performance／feel | 三Modifier共存、additive damage composition、presentation-channel priority、pool／atlas stress、diagnostics與theme tuning | 組合有效但不遞迴暴增；所有動畫都有短attack、明確頓點與乾淨settle；大量Crack／Volatile下仍維持目標效能與可讀性 |

每次驗收修正完該slice的規則與節奏後再進下一次。第六次是整體整合與調校，不應承擔前五次尚未完成的lifecycle、damage correctness或核心presentation。

## 16. Future decisions

以下未由本文首版規則決定：

- VOLATILE跨-owner強化的world-space radius、target geometry、card／rank來源與是否改變processing budget；
- DISCONNECTED的low-neighbor、core reachability、bridge／articulation或細弱連接強化；
- 同名Modifier的Rank、stack或replacement規則；
- eligible definitions低於兩張時的單張／自動取得／替代reward流程；
- 第二隻以後Boss的Modifier pool、reward cadence與weights；
- Modifier在HUD與run result中的長期統計／展示格式；
- status之間未列於Interaction matrix的未來元素組合；
- replay／save跨content version需求。

這些項目在確認前不得加入card pool、建立dormant Runtime branch或由工程自行推導。
