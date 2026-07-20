# RHOMBUS Boss Content Sheet

> 狀態：M1～M6 prototype 垂直切片已完成；Body、Orbit、局部戰鬥、完整等角 launch ring、逐枚曲線釋放、collapse、Encounter reward、diagnostics 與 5,000 Living Glyph 壓力案例均已接入 Runtime／Rendering。瀏覽器實機的字型輪廓、遮擋節奏與最終手感仍依第 16、17 節人工驗收。本文不保存可調參數的 current default；所有 tuning values 只進入 RHOMBUS 的 validated authoring definition。

本文是第二隻正式 Boss `RHOMBUS` 的專屬內容設定。跨怪物共用的生命、Glyph、Damage、Material、Boss reward 與效能規則仍以 [`spec.md`](../../spec.md) 與 [`AGENTS.md`](../../AGENTS.md) 為準；玩家接觸與 hostile projectile 受傷以 [`player-survival.md`](player-survival.md) 為準；`DISCONNECTED`、`VOLATILE` 與 Modifier reward 以 [`run-modifiers.md`](run-modifiers.md) 為準；與第一波 `SLIME` 的共同生成關係另見 [`slime-boss.md`](slime-boss.md)。不要把本文的 RHOMBUS 形狀、攻擊或調校數值搬進 `AGENTS.md`。

預定的唯一 Boss Gameplay authoring source 是實作階段建立的 `src/game/content/bosses/rhombusBoss.ts`。在該模組存在前，本文只固定產品不變量、欄位語意、公式、驗證條件與待定決策，不冒充 production config。

## 1. 內容摘要

| 欄位 | 首版契約 |
| --- | --- |
| `contentId` | `boss.rhombus.prototype` |
| `contentVersion` | `1` |
| 分類 | 第二隻正式 Boss |
| 字元範圍 | Printable ASCII |
| Body Glyphs | `R`、`H`、`O`、`M`、`B`、`U`、`S` |
| Attack Glyphs | `<`、`>` |
| Attack font | 共用 hostile-attack font bank；不使用 RHOMBUS-only Body font |
| Creature owner | 1 個 |
| Canonical components | 主菱形、次菱形、單格方塊，共 3 個互不相連的 components |
| 主菱形 | 固定邊長 15 的實心 45° square，共 421 Cells |
| 次菱形 | 固定邊長 5 的實心 45° square，共 41 Cells |
| 最小伴體 | 1 個顯示 `R` 的正立方形 Cell |
| 初始總 Cells | 463 |
| 預設 Material | RHOMBUS 專屬硬質磚瓦 Material，不重用普通怪 ROCK |
| Appearance Profile | 暗而有重量的黃沙色 Boss semantic role |
| 移動 | 緩慢、具重量與阻尼的 root locomotion |
| 主動攻擊 | 每波先以主體中心形成完整等角 `<>` 圓環，再沿圓周依序釋放各自的曲線尖刺 |
| 接觸傷害 | 三個 components 共用 prepared Boss Definition 的 `contactDamage` |
| 正式擊敗獎勵 | Encounter-level XP reward，加上一次 Run Modifier reward |

463 是固定 Body Blueprint 的 Cell 數，不是 Durability。RHOMBUS 沒有可獨立扣除的 Entity HP；Current／Max HP 永遠由 463 個 Glyph Cells 的 Durability 唯讀聚合。

## 2. LOADING 與 authoring ownership

LOADING 由 GameHost 協調彼此不反向依賴的準備工作：

- Pure content compiler 驗證並編譯三個固定 Body Blueprints、canonical topology、Glyph sequence、耐久磚瓦群、移動／環繞／攻擊／死亡參數及最大 gameplay footprint；不得 import PixiJS。
- Font／Atlas bootstrap 先載入 RHOMBUS-only Body 字型資產，並準備由所有敵方攻擊共用的 hostile-attack font bank；Body Printable ASCII 與 hostile-attack 的 `<`／`>` frames 都必須在共享 Glyph Atlas 中完成驗證，且不得建立或修改 WorldState。
- Combat visual theme 準備 RHOMBUS Boss、hostile spike 與 collapse 所需 semantic roles；所有實際 `#RRGGBB`、alpha 與 presentation tuning 仍只存在集中 theme authoring config。
- GameHost 只有在 content、font、atlas 與 theme 全部成功後才可進入 `READY`。缺字、字型載入失敗、atlas clipping、非法數值或不合法 shape 都必須讓 LOADING 失敗，不得以 fallback 字型啟動部分模擬。

真正的 Creature、Encounter、Glyph IDs、Current Durability、world position、orbit phase、attack scheduler 與 hostile projectiles，只能在 Runtime 收到合法 Boss spawn event 後建立。

RHOMBUS authoring definition 至少分離：

- Body geometry 與 font geometry；
- component durability 與 reinforced-cluster compiler；
- root locomotion；
- 兩組 orbit profiles；
- RHOMBUS Material response；
- hostile spiral attack；
- contact damage；
- collapse／pile presentation；
- XP／Modifier reward identity。

不得在 `movementSystem`、`collisionSystem`、renderer 或一個中央 species `switch` 內散落 RHOMBUS tuning。

## 3. 固定三 component Body Blueprint

### 3.1 數位菱形定義

首版的「邊長 `n`」使用固定 digital-diamond 定義：

```text
occupied when abs(column) + abs(row) <= n - 1
row count = 1, 3, 5, ..., 2n - 1, ..., 5, 3, 1
cell count = n² + (n - 1)²
```

因此：

```text
main:      n = 15 → 15² + 14² = 421 Cells
secondary: n = 5  →  5² +  4² =  41 Cells
satellite:                         1 Cell
total:                           463 Cells
```

主菱形的 row widths 固定為：

```text
1 / 3 / 5 / 7 / 9 / 11 / 13 / 15 / 17 / 19 / 21 / 23 / 25 / 27 / 29
/ 27 / 25 / 23 / 21 / 19 / 17 / 15 / 13 / 11 / 9 / 7 / 5 / 3 / 1
```

次菱形的 row widths 固定為：

```text
1 / 3 / 5 / 7 / 9 / 7 / 5 / 3 / 1
```

這些是 v1 形狀不變量，不是可調 balance value。要改邊長或 Cell 數，必須更新 content version、本文與 shape validation，而不是只改 Runtime 常數。

### 3.2 Character sequence 與 Glyph 身分

- 主菱形依穩定 row-major slot order 重複 `RHOMBUS`；該 component 的第一個 occupied slot 從 `R` 開始。
- 次菱形使用自己的穩定 row-major order，重新從 `R` 開始重複 `RHOMBUS`，不延續主菱形的 sequence index。
- 單格方塊固定顯示 `R`。
- 每個 occupied slot 在 LOADING 取得 stable `slotId`、component-local canonical coordinate、sequence index 與 character。
- Runtime 建立後，每個 Cell 保留 stable Glyph ID、character、Current／Max Durability 與 component membership。環繞、受擊、Husk、depth band 或死亡演出不得交換 character 或複製 Cell。

### 3.3 一個 owner、三個 canonical islands

三個外觀部位必須屬於同一個 Creature owner 與同一個 Boss Encounter。它們不是三隻怪，也不是三份 HP。

- 每個 component 內採四方向 canonical adjacency。
- 三個 components 彼此沒有 canonical edge；畫面靠近、重疊、前後穿越或 orbit phase 都不能建立 adjacency。
- 主體與伴體的 screen-space／world-space 距離不參與 Living topology classification。
- 所有 463 Cells 一起決定 Encounter Current／Max HP；只有全部 Cells 都成為 `HUSK` 才能進入 `COLLAPSING`。
- 伴體不得為了獨立移動、depth sorting、碰撞或 `DISCONNECTED` 方便而拆成另一個 owner。

權威位置仍遵守共用公式：

```text
worldGlyphPosition
= creatureRootPosition
+ layoutAnchor
+ bodyMotionOffset
+ deformationOffset
```

主菱形、次菱形與方塊的固定 slot geometry 屬於 `layoutAnchor`；orbit translation 屬於 deterministic `bodyMotionOffset`；受擊位移與硬質回復屬於 `deformationOffset`。

## 4. RHOMBUS-only 字型與幾何調整

RHOMBUS 的專用字體只套用於 RHOMBUS Body Cells，不得全域替換玩家、普通怪、SLIME、UI 或其他 attacks 的字體。

`<>` 明確不使用 `bodyFontAssetId`、`bodyFontFamily` 或 RHOMBUS Body raster geometry。RHOMBUS attack profile 只引用 stable shared hostile-attack font-bank ID 與已準備的 `<`／`>` frame IDs；該共用 bank 的字型資產、family、raster geometry 與 atlas placement 由共用 font／atlas authoring 擁有，不得複製進 RHOMBUS definition。

Boss definition／font profile 至少提供並驗證：

| Field | Ownership and semantics |
| --- | --- |
| `bodyFontAssetId` | RHOMBUS-only bundled font asset；首版優先使用明確版本的 local WOFF2 |
| `bodyFontFamily` | Atlas rasterization 使用的明確 family，不讀取平台 fallback 結果 |
| `bodyFontRasterSizePx` | LOADING rasterization 尺寸 |
| `bodyFontBaselineOffsetPx` | 修正 glyph 在 atlas cell 內的視覺基線 |
| `bodyGlyphScale` | Body Glyph 的 render scale；不反推 Gameplay spacing |
| `columnAdvanceWorldUnits` | 同列 canonical columns 的權威水平間距 |
| `rowAdvanceWorldUnits` | 相鄰 rows 的權威垂直間距／可調行高 |
| `glyphCollisionRadiusWorldUnits` | 每個 Body Cell 的權威碰撞半徑 |
| `atlasPaddingPx` | 防止 custom font 被 atlas frame 裁切的 raster padding |

純正菱形以瀏覽器實機看到的 Glyph silhouette 為驗收目標。`columnAdvanceWorldUnits`、`rowAdvanceWorldUnits`、字型、baseline 與 scale 可以一起調整，但 Gameplay anchors 與 hitbox 只能讀 prepared fields，不能讀 Canvas／browser text bounds 後在 Runtime 動態推導。

Loading 順序固定為：

```text
load and await RHOMBUS Body font and shared hostile-attack font assets
→ validate distinct font／bank identities
→ rasterize RHOMBUS Printable-ASCII bank
→ rasterize／prepare shared hostile-attack bank
→ validate Body frames、hostile `<`／`>` frames and clipping
→ prepare pooled views
→ READY
```

高量 Body Cells 使用共享 atlas frames 與 pooled `Particle`／`Sprite` views。不得為 463 個 Cells 建立 463 個 PixiJS `Text`、`HTMLText`、Containers 或 runtime textures。RHOMBUS bank 應與既有 Printable ASCII bank 共用可批次處理的 atlas texture source；若 atlas 容量不足，必須在 LOADING 明確失敗或採已驗證的多頁策略，不得在戰鬥中臨時 rasterize。

所有 Body Glyph 維持正立、`rotation = 0`。45° square 的感覺來自 slot geometry，不是把字母本身旋轉 45°。只有 `<>` 攻擊會依切線旋轉，collapse fragments 才能在戰鬥碰撞移除後自由旋轉。

## 5. Durability 與磚瓦 cluster compiler

RHOMBUS 的耐久只存在各 Glyph Cell。Prepared content 以具名欄位提供：

- `mainBaseCellMaxDurability`；
- `secondaryBaseCellMaxDurability`；
- `satelliteCellMaxDurability`；
- `reinforcedClusterCount`；
- `reinforcedCellMaxDurability`；
- `reinforcedClusterLayoutSeed`。

所有數值的 current authoring values 只存在未來的 RHOMBUS definition。每個 Max Durability 必須是有限正值；`reinforcedCellMaxDurability` 必須高於主體 base value。Total Max Durability 是編譯後 463 Cells 的唯讀加總，不另保存一份可以受傷的 budget。

高耐久磚瓦只配置在 421-Cell 主菱形。次菱形與單格伴體使用各自 prepared base durability，不參與磚瓦 cluster selection。

### 5.1 Cluster shapes

每個 cluster 必須由 2～3 個四方向相連的 main-body Cells 組成。首版 shape library：

- horizontal domino；
- vertical domino；
- horizontal straight triomino；
- vertical straight triomino；
- 四種旋向的 L triomino。

不得以對角相鄰的兩格冒充一群，也不得讓兩個 clusters 共用 Cell。

### 5.2 Deterministic irregular placement

LOADING 以固定 content seed 編譯一條 prefix-stable 的 ranked cluster sequence：

1. 從主菱形 canonical grid 產生所有合法 shape candidates。
2. 排除超出 body、碰觸極端四個尖端、無法保留可讀 ordinary-cell gap 或與已選 cluster 重疊的 candidate。
3. 使用 stable hash、位置、方向、radial band、既有選擇與 negative-space score 排序；不得呼叫 `Math.random()` 或消耗 run RNG。
4. Greedy 逐一接受候選。每次選擇只依固定 seed 與先前已選 prefix，因此 cluster count 從 `N` 增為 `N + 1` 時，原本前 `N` 群的位置不變，只新增下一群。
5. 相鄰 clusters 之間至少保留一個 ordinary Cell。部分群可以彼此較近形成磚瓦帶，但不能黏成一大片連續裝甲。
6. Score 刻意避免鏡像成對、四象限等量、等半徑、等間距與固定方向循環；同時保留至少數塊明顯 negative space，讓分布呈現「有設計的錯落」而不是均勻撒點。
7. `reinforcedClusterCount` 超過 compiler 可提供的合法 prefix 時，content preparation 必須拒絕；不得縮小 gap、覆蓋舊群或在 Runtime 補亂數。

Cluster layout 對相同 content version、seed 與 count 必須逐 Cell 可重現。不同 run 不重抽磚瓦位置，讓玩家能從外觀學習 RHOMBUS 的結構。

### 5.3 Life-state invariants

- 每格初始 `currentDurability = maxDurability`，狀態為 `HEALTHY`。
- `0 < currentDurability < maxDurability` 時為 `DAMAGED`。
- `currentDurability = 0` 時為 `HUSK`，不再接受 Durability damage，但仍是 active outline、hitbox 與 orbit 的一部分。
- Reinforced cluster 只提高既有 Cells 的 Max Durability，不增加第 464 格、不建立護甲 HP，也不改變 canonical adjacency。
- Reinforced Cell 進入 Husk 後不得因 death brightness lift、Material recovery 或 orbit 回到 Living。

## 6. Root movement 與重量感

- RHOMBUS root locomotion 緩慢、平順且有明顯阻尼；不能用瞬移或高頻轉向補償大型 footprint。
- `maximumSpeed`、`trackingResponsiveness`、`turnResponsiveness` 與 death-review wander 所需的共用倍率只讀 prepared content／player-survival config。
- `RUNNING` 時可依既有 Boss targeting 規則追蹤玩家；`DEATH_REVIEW` 立即解除 player target，沿用玩家生存文件的 deterministic no-target wander，不再發射尖刺。
- Root locomotion、orbit、Material deformation 與 collapse 是四個分離責任；任一系統不得清空其他來源的 offset。
- 主菱形不自轉。它在 `ACTIVE` 期間維持固定 canonical orientation，重量感來自慢速 root movement、硬質局部 displacement、伴體 orbit 與有頓點的攻擊 cadence。

## 7. 兩組 authoritative orbit

Orbit 使用 Gameplay simulation time。`PAUSED_MENU`、`PAUSED_UPGRADE`、`PAUSED_MODIFIER` 及任何完整 Gameplay pause 都凍結 phase、active revolution progress、post-revolution pause 與兩組 stagger，不讀 wall clock。

每組 orbit profile 明確提供：

- `revolutionDurationMs`：一次 active 360° revolution 的時間；
- `postRevolutionPauseMs`：完整一圈後停住的時間；
- `direction`：`CLOCKWISE` 或 `COUNTERCLOCKWISE`；
- `initialPhaseRadians`；
- `initialDelayMs`／`cadenceOffsetMs`；
- 主、次軸 world-unit radii；
- front／behind depth-band thresholds 與 transition hysteresis。

Revolution 與 pause 是兩個獨立參數。延長 pause 不得拖慢 active revolution；改 revolution duration 也不得按比例改寫 pause。一次 revolution 完成後停在同一個合法 phase，pause 結束才繼續下一圈，不得重設到起點或產生位置跳躍。

### 7.1 次菱形：水平透視 orbit

- 次菱形的 orbit center 位於主菱形中心線向下恰好一個 prepared `rowAdvanceWorldUnits`。
- Orbit 的主要軸是 screen/world x 方向；次軸提供較小的 y offset，避免完全水平移動看不出前後環繞。
- 位於主體前方半圈時，次菱形的權威 y 位置較低；位於後方半圈時較高。
- 次菱形只整體公轉，不自轉。41 個字母維持正立、彼此相對 slot geometry 不變。
- 首版內容意圖是順時針，但實際方向必須由 prepared `direction` 提供，方便 config 調整。

### 7.2 單格方塊：45° orbit

- 單格 `R` 的 orbit 主軸固定為由右上至左下的 45° screen/world diagonal。
- 初始可讀位置在主體右上；front／behind cue 使用與次菱形相同的語意，但由自己的 phase 與較小 depth offset 解析。
- 它與次菱形的 active revolution／pause cadence 必須有 prepared stagger，不能同時起轉、同時停住而退化成一組機械同步動畫。
- 首版內容意圖是逆時針，但實際方向同樣只讀自己的 prepared `direction`。
- 單格方塊不自轉，`R` 在 active combat 中維持正立。

兩組 orbit 的 positional offsets 都是 Runtime-owned Body Motion，會改變 precise hit、DamageShape 與 player contact collision。只有前後遮擋是 presentation；不能因部位畫在主體後方就取消其 hitbox 或 Durability。

## 8. Depth bands 與 PixiJS batching

RHOMBUS 需要一個 generic、bounded depth contract：

```text
BEHIND
BODY
FRONT
```

- 主菱形固定解析為 `BODY`。
- 兩個伴體由 Runtime 依各自 frozen orbit phase 解析 `BEHIND`、`BODY` 或 `FRONT`；bridge／render snapshot 傳遞 resolved band。
- Renderer 不得從 species ID、screen y、Sprite order 或遮擋結果反推 band。
- 伴體在後方時必須被主體遮住；前方時必須完整畫在主體上方。Crossing thresholds 使用 prepared hysteresis，避免邊界連續換 layer。
- Depth band 只改 render order，不改 world position、topology、collision、targeting、`DISCONNECTED`、`VOLATILE` 或 Durability。
- 實作使用少量全域 pooled Glyph bands，不為每個 RHOMBUS、每個 component 或每次 orbit 建立 Pixi Container／RenderLayer。
- `CRACKED` surface、`DISCONNECTED` cue、Volatile source overlay 與其他附著於 Glyph 的 bounded Modifier presentation 必須跟隨同一 resolved band，避免後方伴體的裂片或亮點穿透主體。

若 shared `ParticleContainer` 需要依 band 轉移 view，轉移只在 band 改變時發生；不得每幀 remove／add 全部 41 個次菱形 Cells。

## 9. RHOMBUS Material、受擊與 topology consequences

### 9.1 硬質磚瓦 Material

RHOMBUS 使用專屬硬質 Material：

- 局部 displacement 與 knockback response 明顯低於 SLIME；
- recovery 剛硬、阻尼高、回正俐落，不呈現果凍式長尾；
- reinforced／ordinary Cells 共用 Material identity，耐久差異由 Max Durability 表達；
- Material 參數與 Appearance Profile 正交；不得複製普通怪 ROCK Material 後只改顏色，也不得用黃沙 tint 代替硬質 Gameplay response。

`Impact Cells` 與 `Damage Targets` 仍遵守共用 Glyph damage contract。Living 與 Husk 都可在真實 Impact Cell 播放局部硬質 response；Husk 的 Current Durability 保持零。遠端 topology-transfer target 在 pulse 抵達前不變亮、不扣 Durability，也不取得來源 Impact Cell 的 Material impulse。

### 9.2 Component-scoped direct transfer

三個 components 沒有 canonical path。當 direct attack 命中某個 component 的 Husk 區域時：

- traversal ray 與 fallback 只能在該 source 所屬的 canonical component 內尋找 Living Damage Target；
- 不得因三個 components 共用 owner，就從已全 Husk 的伴體跳到主菱形；
- 若該 component 已無 Living Cell，這次命中仍可成立為 local outline impact 並播放低亮局部 response，但不建立跨空隙的 pending transfer，也不造成遠端 Durability damage。

實作應把這條規則表達為 generic prepared traversal scope，例如 `CANONICAL_COMPONENT`，而不是在 damage system 寫 `if (species === RHOMBUS)`。

### 9.3 DISCONNECTED 與 VOLATILE

- 三個 authored islands 都正常參與 `DISCONNECTED`，沒有 Boss 或伴體豁免。
- Protection 與 multiplier 每次依當下 Living canonical components 動態計算。次菱形與小方塊通常較小，但不是永久標記為易傷；主體被侵蝕後，relative component sizes 改變時結果也可改變。
- Orbit、depth band、screen overlap、Material deformation 與 root knockback 都不會 invalid canonical topology cache。
- RHOMBUS 沒有 SLIME 的 split／reassembly latch；它不會因小塊受傷而聚合或改 owner。
- `VOLATILE` 只沿同一 component 的 canonical adjacency傳播；即使伴體從主體前方擦過，也不能跨空隙連鎖。
- 已全 Husk 的 isolated component 不再屬於 Living component；`DISCONNECTED` 不會為它建立通往其他 component 的 topology。

完整公式與 interaction matrix 以 [`run-modifiers.md`](run-modifiers.md) 為準。

### 9.4 玩家接觸

三個 components 的 Living 與 Husk Cells 在 RHOMBUS 為 `ACTIVE` 時都參與 player contact collision。每個 fixed step 即使主體、次菱形與小方塊同時碰到玩家，整個 RHOMBUS owner 仍最多 append 一筆 contact candidate：

- damage 取 prepared `contactDamage`；
- route 使用 creature contact 的 `SHIELD_FIRST`；
- orbit y offset 參與 precise collision；
- depth band／遮擋不參與 collision；
- `MATERIALIZING`、`COLLAPSING`、`DEFEATED` 不造成接觸傷害。

候選最後仍交給 [`player-survival.md`](player-survival.md) 的全域 ordering、invulnerability 與 Shield／Health resolver。

### 9.5 Assisted player targeting anchors

RHOMBUS 的主菱形、次菱形與單格方塊都提供 stable、同 owner 的 Assisted targeting anchor。這些 anchors 只幫助玩家武器選擇瞄準點，不是新的 Creature、HP、Damage Target 或 reward identity。

- RHOMBUS owner 進入合法 assisted target query 時，三個當下合法 anchors 一起參與評分。Owner 的 anchor score 取它們之中離該次未套用 assisted correction 的權威發射彈道幾何 miss distance 最小者；不得只量 Creature root，也不得改成離玩家、游標或 screen-space sprite 最近者。
- 等距時依沿彈道最早的正向位置，再依 stable component／anchor ID 裁決；不能用迭代順序或畫面排序決定。既有 owner-level acquisition gate、tracking load 與跨 owner tie-break 仍由武器契約統一處理，不在 Boss content 複製。
- 鎖定後保存 stable anchor ID 並讀取其當下權威 world position，因此次菱形與方塊的 orbit 會移動追蹤目標；不得在每個 fixed step 偷換成同 owner 的另一個 anchor。Anchor 失效時沿用 Assisted projectile 的既有 target-loss／ballistic 規則，不在 RHOMBUS 內另做 reacquisition。
- Renderer 的插值、depth band 與遮擋不參與 targeting。三個 anchors 由既有 component／motion-group transform 準備，不得逐 Cell 掃描 463 格或從當幀畫面 centroid 反推。
- Projectile Count 的同一 assisted volley 仍遵守既有「一次 initial target query、共用一個 selected target anchor」契約；本項決策不暗中改成每枚 projectile 重新查詢。真正命中仍由每枚 projectile 的權威路徑與 Glyph-level collision 決定。
- 三個 anchors 始終引用同一 Creature owner；不得為了 target lock 拆 owner、建立三份 HP，或讓一次命中因多 anchor 重複套用傷害。

## 10. `<>` launch-ring curved spiral hostile attack

### 10.1 Gameplay identity

每一枚尖刺是一個 Runtime-owned hostile projectile state 與一個 stable incoming-damage event identity，視覺由兩個 Glyph views 組成：

```text
<>
```

`<` 與 `>` 必須盡量靠近但不能實際接觸。`pairSpacingWorldUnits` 控制兩者中心間距；它與 projectile collision geometry 都由 prepared attack profile 提供。兩個 views 不能各自產生 damage、event ID 或 invulnerability interaction。

一波攻擊先一次建立 `spikesPerWave` 個 stable wave members，生命週期為：

```text
STAGED_IN_RING → ACTIVE → SPENT／DISSIPATING
```

- `STAGED_IN_RING` 的全部尖刺在同一個 authoritative formation commit 出現，依 stable `waveSlotIndex` 等角分布成完整圓環；不得按 emission 時間才逐枚在同一點生成。
- 等待中的尖刺已可見，且 `<>` 已朝向自己曲線的初始切線，但不推進 travelled distance、不做 hostile swept collision，也不能 append incoming-damage candidate。
- 未輪到的尖刺留在自己的圓環 slot；它們只隨當下主菱形中心作整圈平移，不提前沿曲線前進、不收攏到同一條線，也不因 renderer interpolation 改變 slot order。
- 每次 emission 是把下一個 stable wave member 從 `STAGED_IN_RING` 切換為 `ACTIVE`。只有 `ACTIVE` 才取得曲線運動、碰撞與傷害身分。
- 一波只能存在一組尚未釋放的 launch ring；不得因 fixed-step catch-up 重複建立、漏建或讓下一波圓環覆蓋目前 wave state。

兩個 views 明確引用 shared hostile-attack font bank 已準備的 `<`／`>` frame IDs。不得在 emission 時載入字型、建立 PixiJS `Text`／runtime texture，或由 renderer 根據 RHOMBUS definition ID 私自選擇 font bank。

每枚尖刺在自己的 emission fixed step snapshot 當下主菱形中心作為 immutable curve center，並以該 wave slot 當下的圓環 world position作為曲線起點。Boss 後續移動不拖曳已射出的軌跡；Renderer 也不能把 `ACTIVE` projectile attach 回 Creature。仍在 `STAGED_IN_RING` 的尖刺則繼續依前述 owner-relative launch ring 規則跟隨主體平移。

### 10.2 圓環起始的真實 Archimedean curve family

首版使用一組從等角 launch ring 向外展開、constant path-speed 的 Archimedean curves。令 `i` 為 `0 ... spikesPerWave - 1` 的 stable `waveSlotIndex`，令 `θ >= 0` 為該尖刺釋放後的 angular progress：

```text
slotAngle(i)
= launchRingInitialPhaseRadians
  + directionSign × 2π × i / spikesPerWave

r(θ)
= launchRingRadiusWorldUnits
  + spiralTightnessWorldUnitsPerRadian × θ

worldAngle(i, θ)
= slotAngle(i) + directionSign × θ

radial growth per full revolution
= 2π × spiralTightnessWorldUnitsPerRadian
```

因此 `θ = 0` 時，全部 wave members 位於同一個 `launchRingRadiusWorldUnits`，相鄰 slot 的角距嚴格為 `2π / spikesPerWave`。它們是一組依 slot 旋轉過的獨立曲線，不是所有尖刺沿同一條曲線排隊，也不是用正負 offset 複製成兩條鏡像路徑。

Runtime 以 `flightSpeedWorldUnitsPerSecond` 推進 travelled path distance，再沿 prepared arc-length lookup／deterministic solver 取得 θ；不得用固定 angular speed 造成半徑越大線速度越快，也不得把 straight radial velocity 加 renderer sine offset 假裝曲線。

Projectile world position、previous position、current position、tangent velocity、travelled distance 與 lifecycle state 都是權威資料。每枚 `<>` 在 `STAGED_IN_RING` 就對齊自己曲線於 `θ = 0` 的 derivative／初始切線；切線包含向外的 radial growth 與該波 direction 造成的切向分量，不能只讓字元純粹朝圓心外側。切換為 `ACTIVE` 後，視覺軸持續對齊當步 curve tangent，讓尖刺朝向實際飛行方向；rotation 影響 presentation，precise collision 則使用 prepared swept shape。

`spiralTightnessWorldUnitsPerRadian` 的調校目標是讓徑向外射成為主要速度分量，順時針角位移只留下可辨識但克制的 curve。尖刺不能像貼著 Boss 公轉，也不能完全退化成無曲率的直線。實際 current value 只寫入 RHOMBUS authoring definition。

每一波都使用 prepared、fixed 的 `launchRingInitialPhaseRadians` 定義第一個 slot，不 snapshot 玩家位置、不依游標重新瞄準、不消耗 run RNG，也不讀 renderer／wall-clock 狀態。波次開始時必須先建立完整圓環並保持 `launchRingHoldMs`，之後才依 current wave 的 `directionSign` 沿圓周逐枚釋放：slot `0` 先射出，再依 `emissionIntervalMs` 前進至下一個 slot。尚未釋放者保留在圓環；已釋放者從自己的 slot 主要沿半徑向外飛行，只帶少量順時針 curve，因此畫面形成依序展開的外散扇形，而不是繞著 Boss 公轉。

`CLOCKWISE`／`COUNTERCLOCKWISE` 同時決定 slot traversal order 與每條 curve 的 handedness。RHOMBUS v1 的辨識動作固定為每波順時針依序向外散開；authoring contract 仍保留其他 validated direction mode，供未來內容版本使用，但不能在同一個 v1 Encounter 交替方向。不得讓每個 slot 共用相同 initial phase，也不得另生成第二條鏡像 lane。

尖刺不能在射出後仍近似維持等角圓環或繞王旋轉。Authoring preparation／production-content test 必須確認：初始切線的絕大多數速度投影指向徑向外側；一個 `emissionIntervalMs` 內的角位移只占少量 slot angle，同時徑向距離大於 `pairSpacingWorldUnits`。完整 travel budget 仍須累積一段大於零但受限的順時針角位移，確保它是「外射帶小曲線」而不是完全筆直。

### 10.3 Wave cadence 與 config fields

Prepared attack profile 至少提供：

| Field | Semantics |
| --- | --- |
| `damage` | 一枚 projectile 被接受時的 incoming damage amount |
| `damageRoute` | 首版明確 author 為 `SHIELD_FIRST`；不得從 Boss 名稱推測 |
| `flightSpeedWorldUnitsPerSecond` | 沿 curve arc length 的 constant path speed |
| `spikesPerWave` | 每波 launch ring 的 stable slot 總數；首版至少為 3，才能形成圓環 |
| `launchRingRadiusWorldUnits` | 所有 staged slots 與 curve 在 `θ = 0` 時共用的正半徑 |
| `launchRingInitialPhaseRadians` | slot `0` 的 fixed 圓周相位；必須有限、在 preparation 正規化並對該局凍結 |
| `launchRingHoldMs` | 完整圓環形成後、第一枚可釋放前的正 Gameplay-time 可讀停頓 |
| `emissionIntervalMs` | 同一波相鄰 `STAGED_IN_RING → ACTIVE` transitions 的 Gameplay-time 間隔 |
| `waveIntervalMs` | 最後一枚完成釋放後，到下一波完整 launch ring formation 的間隔 |
| `spiralTightnessWorldUnitsPerRadian` | Archimedean spiral 每弧度增加的 radius |
| `spiralDirectionMode` | `CLOCKWISE`、`COUNTERCLOCKWISE` 或 `ALTERNATE_PER_WAVE` |
| `firstWaveDirection` | alternate mode 的第一波方向 |
| `maximumTravelDistanceWorldUnits` | projectile cleanup 的 authoritative path-distance budget |
| `projectileCollisionRadiusWorldUnits` | 玩家 swept collision 使用的 combined projectile geometry |
| `pairSpacingWorldUnits` | `<`、`>` 的視覺／幾何中心間距 |

所有 timing 使用 Gameplay simulation time並在完整 pause 凍結。每波是「整圈 formation → hold → 一枚釋放 → 間隔 → 下一枚釋放」，不是逐枚同點生成，也不是同一步 burst。`waveIntervalMs` 只在最後一枚釋放後開始；下一個 launch ring 不得與前一波尚未完成的 scheduler 重疊。上一波仍在遠處飛行的 projectile 可以維持 `ACTIVE`，但當下一圈形成時，最晚釋放的上一波尖刺也必須已離開 launch-ring 視覺帶並持續向外；不得讓上一波殘留讀成第二個完整同心圓。

RHOMBUS v1 每波皆採順時針；真正 prepared value 仍必須由 authoring definition 明確提供，Runtime 不得藏 implicit default。其他 direction mode 只保留給未來內容版本或明確的調校實驗。

### 10.4 Collision 與 incoming damage

- 使用 previous-to-current authoritative curved segment 對玩家做 swept collision，避免高速度跨越玩家。
- Projectile broad phase 使用 swept bounds，precise phase 使用 prepared combined shape；不能讓兩個 Glyph views 各判定一次。
- `STAGED_IN_RING` 尖刺不進 hostile-projectile collision broad phase，也不能 append candidate；只有切換為 `ACTIVE` 後才開始以自己的 previous／current curved segment 參與 swept collision。
- 每枚 projectile 的 stable event ID 只允許 append 一筆 incoming-damage candidate。
- 只有第一次 precise swept physical overlap 才消耗尖刺；broad-phase candidate 本身不消耗。合法 overlap 會 append 最多一筆 candidate，並在 structural boundary 將該 projectile 標記為 spent／cleanup。即使 Player Survival resolver 因 global invulnerability 忽略該 candidate，尖刺仍已消耗，不得保留到無敵結束後再次命中；被忽略的 candidate 仍不消耗 Shield、不扣 Health、不重設 recharge，也不產生 accepted-hit presentation。
- Creature contact collector 與 hostile projectile collector 共用同一個 per-step candidate buffer；buffer 每步只在共同邊界 reset 一次，兩者都只能 append，最後由 Player Survival resolver stable sort並解析一次。
- 完整 pause 凍結 launch-ring hold、staged slots、active projectile path、emission scheduler 與 collision。
- 玩家進入 `DEATH_REVIEW` 後 attack scheduler 停止；所有 hostile spikes 立即失去 damage／collision identity。若保留短暫殘影，只能是 rendering-only，不能改寫已凍結的 run result。
- RHOMBUS 進入 `COLLAPSING` 的同一 authoritative transition 會停止 attack scheduler，並讓圓環內所有 `STAGED_IN_RING` 與在途 `ACTIVE` 尖刺立即失去 damage、collision、candidate 與曲線運動身分。每枚尖刺凍結在當下權威 position、tangent rotation 與 pair spacing，建立一次 stable dissipation presentation：兩個 Glyph views 停在原地、冒出 pooled ASCII particles，接著快速 fade out並歸還 pool。這個短消散不恢復 Gameplay projectile、不延後 combat collision removal，也不阻擋 Encounter body collapse／reward settlement。
- Spike dissipation 的 freeze pose、stable presentation identity 與 Gameplay／collapse presentation-time progress由Runtime授權；Renderer只以shared hostile atlas的兩個pooled `Particle` views和粒子pool消費snapshot。它不能繼續推進curve、觀察玩家無敵、重新建立candidate，或因pool miss改變cleanup與reward結果。
- Hostile projectile 使用 pool；pool miss 不得令已授權的 gameplay projectile無聲消失，visual particle budget也不得改變 collision。

## 11. 色系、亮度與 attack presentation

RHOMBUS 使用暗而有重量的黃沙色 Boss Appearance Profile：

- Living body 保持偏暗、具砂岩／磚瓦辨識度的黃色系，不使用淺黃、粉彩或洗白來假裝 Boss tier。
- Direct impact、Durability 下降與 Husk 都留在 RHOMBUS 自己的黃沙 palette；Damage Spread secondary feedback 仍依來源玩家 attack role 的 accent。
- Reinforced clusters 的可讀性主要來自 Max Durability 與受損 progression；若需要額外微小 surface distinction，只能新增中央 theme semantic role，不能在 compiler 或 renderer 寫色碼。
- RHOMBUS Boss emphasis 高於 ordinary tier、低於 player attacks；Runtime 只驗證合法 `#RRGGBB` 與 theme structure，不因藝術色值拒絕載入。
- `<>` 使用 hostile-projectile semantic role，亮度必須足以避讓，但不能與玩家 projectile role 混淆。
- `<>` 的 active 與 collapse-dissipation views 都使用 shared hostile-attack font bank；RHOMBUS theme 只選 hostile semantic role與具名fade／particle presentation profile，不擁有或複製共用字型資產。
- Collapse brightness lift 與 pile fragments 使用 RHOMBUS collapse semantic roles；不得恢復 Current Durability 或重新啟用 hitbox。

所有實際 color、alpha、brightness gain、outline、spike trail 與 collapse presentation values 只存在 `src/game/content/visuals/prototypeCombatVisualTheme.ts`。RHOMBUS Gameplay definition只選 semantic role IDs。

`<>` 固定使用 shared hostile-attack font bank，且 `<`／`>` frames 必須在 LOADING 完成準備；不得在 emission 或 collapse-dissipation handoff 時建立 Text或runtime texture。

## 12. 出現時機與 SLIME 位置避讓

- RHOMBUS 是第二隻正式 Boss，正式 encounter schedule 使用 content-defined Gameplay-time gate；Boss 不走普通怪 weighted director，也不使用 player kill count。
- Prototype 期間先與 SLIME 一樣，在第一波開始時取得 spawn authorization。`FIRST_WAVE_STARTED` 仍只由第一隻合法 `Z` 成功 commit 觸發；普通怪 candidate 失敗不能提前生成 Boss。
- 同一 event 可以排入 SLIME 與 RHOMBUS 兩個 Boss spawn requests，但 structural collections只在明確 boundary commit。
- RHOMBUS candidate 使用包含主體、最大 orbit、Material deformation 與 spawn aggregation margin 的完整 footprint。
- RHOMBUS 與 SLIME 的 footprint 之間還要加 prepared `bossSpawnSeparationPaddingWorldUnits`。兩者不能重疊、互相遮住出場或被塞在同一個無法辨識的位置。
- Candidate selection、fallback side 與 retry 使用 seeded stable order。若 RHOMBUS 暫時找不到合法位置，只延後 RHOMBUS request；不得移動已合法 commit 的 SLIME、強塞進 viewport／障礙物或取消整個第一波。
- RHOMBUS 使用 seeded text-aggregation `MATERIALIZING` phase；Runtime 決定轉為 `ACTIVE` 的時間。聚合期間不造成玩家接觸傷害、不發射尖刺。

正式第二 Boss 的精確 Gameplay time gate、spawn cadence、separation padding與 retry tuning只存在 Boss schedule／RHOMBUS prepared content，本文不複製 current defaults。

## 13. Encounter collapse：亮起、垮落、堆疊

Encounter lifecycle：

```text
ACTIVE
→ all 463 Cells are HUSK
→ COLLAPSING: brightness lift
→ COLLAPSING: masonry fall and pile settle
→ DEFEATED
→ XP + one Modifier reward
→ cleanup
```

當最後一個 Living Cell 進入 Husk：

1. Runtime 立即讓 RHOMBUS 離開 targeting、damage reception、player contact、hostile attack scheduling與所有 Gameplay collision；同一 transition 依第 10.4 節讓圓環中尚未釋放與全部在途尖刺停止、失去 damage identity並交給短促消散 presentation，不允許任何 Boss-death 後 candidate。
2. 兩組 orbit停止在當下權威 pose；不得先瞬移回起點。Material deformation也以當下 snapshot作為 collapse起始位置。
3. 全部 Husk短暫恢復一部分presentation brightness，讓玩家看見完整磚瓦輪廓即將失去支撐。這只修改resolved collapse appearance，Current Durability仍全部為零。
4. Runtime建立stable per-Glyph collapse plan。字母沿world／screen可讀的正 y 方向受重力般下墜，帶少量錯拍與rotation；底部先形成support，上層較晚落下並停在不同高度，最後成為有少量交疊、斜靠與局部堆高的混亂字母堆。
5. 不使用463-body通用剛體引擎或逐對 `O(n²)` collision。首版以canonical row、support bands、stable Glyph ID noise、precompiled pile target、rotation與fall delay模擬垮落；相同seed／IDs得到相同結果。
6. Active outline 已在步驟1移除Gameplay collision後，death rule可以把視覺交給pooled rendering fragments；但collapse phase、brightness／fall／settle progression與完成時點仍由Runtime授權，renderer不得自行提早發獎。
7. Collapse presentation與該Encounter已授權的Volatile source-event sequence都完成後，Encounter才第一次進入`DEFEATED`、計一次Boss kill、發一次XP reward並建立一次Modifier reward token。

三個 canonical components 不會各自發獎。Orbiting components先變 Husk或先掉光都不建立獨立 collapse／death reward；只有 Encounter-level lifecycle成立。

## 14. Modifier reward 與第二 Boss 限制

正常 release path（`enableRunStartModifierOfferForTesting = false`）下：

```text
SLIME reward: 3 eligible → player owns 1
RHOMBUS reward: 2 eligible → normal two-choice offer
```

這符合 [`run-modifiers.md`](run-modifiers.md) 的三張／兩張／一張 offer 契約。

開發 testing flag 開啟時：

```text
run-start test: player owns 1
SLIME reward:   player owns 2
RHOMBUS reward: 1 eligible → normal one-choice offer
```

唯一 choice 不會自動取得、跳過或重複已持有 definition。Runtime 仍建立正常 active offer並保持 `PAUSED_MODIFIER`，直到玩家以該 `offerId`／`choiceId` 明確 Confirm。單張 UI 預設亮起的卡必須同時是 React 真實 `selectedChoiceId`，讓 Confirm立即可用；focus／hover不能冒充selected state。若eligible definitions為零，仍依 [`run-modifiers.md`](run-modifiers.md) 的未決fallback處理，不在RHOMBUS content內自行發明。

## 15. Performance 與 diagnostics

固定 shape population：

```text
main static body:        421 Cells
secondary orbit group:    41 Cells
single orbit group:        1 Cell
total:                   463 Cells
```

Hot-path constraints：

- 主體421 Cells不做per-Cell trig、phase、RNG或topology search。Root movement後只套用既有anchors與共享root transform。
- 每個orbit group每個fixed step只計算一次phase、一次必要的sin／cos、一次translation與一次resolveddepth band；41 Cells共用同一group transform，單格方塊取自己的group transform。
- 三個 assisted target anchors 分別重用主體／orbit group transform；target query不得為每個projectile掃描463 Cells或從rendered Glyphs計算centroid。
- Post-revolution pause期間不重算無變化的orbit curve；仍要維持既有authoritative pose。
- Reinforced cluster layout只在LOADING編譯；Runtime不重抽、不重新排序。
- 每次 wave formation 以 `O(spikesPerWave)` 從 pool 建立一組 bounded staged records；waiting ring 只用共享主體中心加預編譯 slot sin／cos，不得每步重建陣列、排序或配置 closure。
- Active projectiles使用prepared arc-length table、object pool、swept spatial query與bounded cleanup distance；hot path不配置temporary arrays／closures。
- Broad-phase footprint包含主菱形、兩個orbit最大radius、Glyphcollision radius、最大Material deformation與spawn aggregation margin。
- Render sync只傳viewport加margin內的Cells／projectiles；depth bands使用boundedglobal pools，不建per-boss scene graph。
- 壓力驗證沿用`AGENTS.md`的5,000 Living Glyph Boss stress；Living與retained Husk分開報告，不因RHOMBUS 463格改寫benchmark。

Diagnostics至少加入：

- active RHOMBUS encounters與463-Cell validation count；
- orbit evaluation time、active／paused group count、band migrations；
- reinforced cluster count、accepted／rejected candidate count與compile time；
- hostile spike waves formed、staged／released／active／expired／pool misses；
- hostile spikes consumed on invulnerable overlap、collapse-frozen／dissipating／returned counts；
- curved swept broad-phase candidates、precise tests與accepted hits；
- collapse brightness／fall／settle counts、fragment pool misses；
- Living／Husk count與orphaned／multiply-owned Glyph IDs。

## 16. LOADING validation 與必要測試

Content preparation必須拒絕：

- 主菱形不是421Cells、次菱形不是41Cells、單格不是1Cell或總數不是463；
- 任一component的fixed side invariant、row widths、stable slot order或`RHOMBUS` sequence不符；
- Body character不是Printable ASCII、shared hostile-attack bank缺少`<`／`>`、任一required frame被裁切，或Body／hostile frames無法使用已驗證的atlas source；
- custom font未完成載入、實際family不符、required frame被裁切或fallback字型被使用；
- `columnAdvanceWorldUnits`、`rowAdvanceWorldUnits`、`glyphCollisionRadiusWorldUnits`或必要scale不是有限正值；
- 三個components之間被編入canonicaledge，或任一component內occupied Cell無stable component ID；
- 任一Max Durability不是有限正值，reinforced durability不高於main base；
- cluster shape不是2～3個connected Cells、互相重疊、落在極端尖端、違反ordinary gap，或requested count超過合法prefix；
- orbit duration／pause／radius／stagger／direction／hysteresis非法；
- spike damage／speed／count、launch-ring radius／initial phase／hold、release interval／wave interval、tightness／spacing／collision radius／travel distance非法；
- spike collapse-dissipation timing／easing／particle profile非法；
- collapse timing、fall profile、pile targets或reward identity不完整。

風險導向的pure／integration tests至少證明：

- 固定shape公式、row widths、sequence與463 stable slot IDs；
- 三個components同owner但沒有cross-componentcanonical path；
- 主菱形、次菱形與單格方塊提供三個stable、同owner target anchors；orbit改變伴體anchor的權威位置，depth band／renderer interpolation不改，選定後不在同owner內偷換anchor；
- orbit direction、revolution／pause分離、stagger、pause freeze與無累積drift；
- 41個次菱形Cells共用一個group transform且所有Body Glyph保持正立；
- front／behind band只改render order，不改hitbox、topology或DISCONNECTED；
- reinforced placement對相同input可重現、count增加prefix不變、分布不鏡像／不均勻且非法high count被拒絕；
- 命中全Husk伴體不把direct topology transfer跳到主體；
- DISCONNECTED動態分類三個islands，orbit不造成cache rebuild，VOLATILE不跨空隙；
- 三個部位同一步接觸只append一筆owner contact candidate；
- wave formation 一次建立全部 stable slots；每格半徑相同、相鄰角距嚴格為 `2π / spikesPerWave`，且每枚 `<>` 在釋放前就對齊自己的初始 curve tangent；
- staged 尖刺保持圓環、不提前推進 curve、不碰撞也不造成傷害；依 direction 與 interval 逐枚切換為 active，不能同一步 burst、漏 slot、重複 slot或退化成同一路徑／兩條鏡像 lanes；
- 每枚 active `<>` 沿以自己 slot angle 旋轉後的真實 curve constant-speed移動、持續 tangent對齊、兩Glyph只造成一筆damage，swept collision不穿過玩家；
- launch ring 與 release order 不因玩家位置、run RNG消耗或render FPS改變；RHOMBUS v1 每波維持順時針且不能暗中切換 handedness；
- precise overlap在global invulnerability期間仍只消耗一次projectile，broad-phase candidate不消耗，ignored candidate不修改Shield／Health／recharge且不能在無敵結束後再次命中；
- RHOMBUS進入`COLLAPSING`時，staged與active spikes都於同一步凍結且失去damage identity，短消散無position drift、不重播、不阻擋body collapse／reward，完成後歸還pool；
- complete pause凍結orbit、launch-ring hold、attack scheduler、staged slots與active projectiles；
- 全463Cells成為Husk前不collapse；collapse亮起不恢復Durability，垮落計畫可重現且只發一次Encounterreward；
- testing flag開啟且只剩一個eligibleModifier時建立exactly one choice、保持暫停並等待顯式Confirm，不靜默跳過、重複或自動取得；預設selected card可立即Confirm。

瀏覽器實機另驗收：

- 自訂字型下主／次形狀仍像純正等邊菱形，字母全程正立；
- 水平與45°orbit能清楚讀出前後關係，遮擋不閃爍；
- revolution快速、pause有重量，兩組節奏錯開而不拖泥帶水；
- 黃沙色、reinforced磚瓦、硬質受擊與玩家攻擊保持視覺層級；
- 攻擊開始先清楚讀到完整、等角且各自朝向初始切線的 `<>` 圓環；尖刺再依順時針 slot order 逐枚主要向外射出，只帶輕微 curve，不得讀成繞王公轉、第二個圓環、同一直線或兩條 lanes；
- shared hostile-attack字型下的`<>`仍清楚可讀；Boss進入collapse時，圓環中尚未釋放與所有在途尖刺都原地冒出粒子並快速fade，不留下長尾或死亡後傷害；
- 全體短暫亮起後垮落成有堆高的字母瓦礫，而不是整齊平鋪。

## 17. 實機 tuning 與 release 前驗收

下列基礎已由 LOADING／prepared content 完成：

- RHOMBUS-only bundled Body font與shared hostile-attack font已有stable asset／family identity，並在LOADING驗證實際載入family與required frames。
- RHOMBUS definition只引用prepared font bank／frame IDs，不複製字型資產設定，也不以Body font替代`<>`。
- spacing、durability、reinforced layout、Material、orbit、attack與collapse參數只有validated RHOMBUS authoring definition一份current source of truth。
- Reinforced compiler輸出candidate／accepted／rejected與compile-time diagnostics；Runtime另報orbit、hostile projectile、collapse與Glyph ownership diagnostics。
- 專屬壓力案例以多個active RHOMBUS超過5,000 Living Glyphs，並同時驗證Orbit、staged spikes、viewport snapshot與depth-band Particle pools。

Release前仍須依第16節的瀏覽器清單人工驗收純正菱形輪廓、front／behind遮擋、兩組Orbit錯拍重量、尖刺外散讀感、硬質受擊與垮落堆疊。若手感需要調整，只修改對應validated authoring config並重跑核心與壓力測試；不得在本文、renderer或測試另存一份current default，也不得以fallback font啟動部分模擬。
