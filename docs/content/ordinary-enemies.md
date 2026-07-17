# Ordinary Enemies — Spawn Progression, Body Identity, and Motion

> 狀態：`Z`、`BO`、`BAT`、`ROCK`、`SNAKE` 的 time-gated multi-enemy progression、權威 Body Motion、rotation rendering、Body Blueprint、Appearance Profile、Director 整合驗證與 headless 壓力 harness 已實作；`SNAKE` 使用本文定義的固定 `K` 擠壓模型。所有 current tunable values 只屬各自 validated authoring module；本文保存欄位語意、相對關係與不變量，不保存目前數值快照。

本文定義首批普通敵人 `Z`、`BO`、`BAT`、`ROCK`、`SNAKE` 的文字身分、Body Blueprint、色系、首次出場順序、權威 Body Motion 與效能契約。普通怪 `SNAKE` 與未來 Boss `ANACONDA` 是不同 Creature Definition；可打斷、分段獨立活動與 Boss Encounter 規則只屬 `ANACONDA`。跨怪物共用的 Glyph 生命、Husk、碰撞、視覺階級與效能規則仍以 [`spec.md`](../../spec.md) 與 [`AGENTS.md`](../../AGENTS.md) 為準；玩家接觸受傷的接受、護盾與無敵規則見 [`player-survival.md`](player-survival.md)。

## 1. 共用 Body Motion 契約

普通敵人的專屬動態是 Gameplay pose，不是 renderer 私自添加的裝飾抖動：

```text
worldGlyphPosition = creatureRootPosition
                   + layoutAnchor
                   + bodyMotionOffset
                   + deformationOffset
```

- Root movement 在一般 `RUNNING` 戰鬥中負責整隻怪物追蹤與位移；玩家死亡進入 `DEATH_REVIEW` 後必須解除玩家 target，並依 [`player-survival.md`](player-survival.md) 改用無目標游走，不得繼續追向玩家死亡座標。
- Layout Anchor 負責 Body Blueprint、morph、重組後的結構位置。
- Body Motion 負責該物種有節奏的局部姿態與旋轉。
- Deformation 負責命中、材質位移、擊退與回復。

位置型 Body Motion 必須由 fixed-step Runtime 計算，碰撞、Damage Shape、後續攻擊與 Render Snapshot 都讀取同一個結果。它不得寫入或重用 material deformation offset，也不得由 renderer 產生另一個與 hitbox 不一致的位置。

每個節拍都從穩定的 Layout Anchor 與 normalized phase 重新求值，不累加前一幀姿態。需要錯開群體節拍時，使用由穩定 Entity ID 或 seeded spawn state 取得的 deterministic phase offset；不得每幀呼叫亂數。

Body Motion 適用於 owner 仍在戰鬥中的所有 `HEALTHY`、`DAMAGED`、`HUSK` Cells。Husk 仍是完整輪廓的一部分，所以不能因 Durability 為零而停止跟隨姿態。進入 `COLLAPSING` 後，Runtime 才停止戰鬥用 Body Motion 並交由崩解規則接管。

## 2. 首次出場順序

普通敵人的 first-appearance progression 固定為：

```text
Z → BO → BAT → ROCK → SNAKE
```

- 初始怪群先由 `Z` 建立最低複雜度的壓力。
- 每個後續物種由 prepared progression 提供 `earliestAppearanceTimeMs`。它使用 Gameplay simulation time；任何完整 Gameplay 暫停、`DEATH_REVIEW` 與結算都不推進登場時間。
- 到達最早時間只代表該物種可以進入 pending debut。前一物種尚未成功 commit 其第一次 spawn 時，後一物種仍不可首次出現。
- Pending debut 具有首次亮相優先權，直到該物種在合法位置成功 commit。Spawn candidate 失敗不算出場、不消耗資格，也不得解鎖下一物種。
- 首次出場成功後，該 definition 才可依 content-defined post-unlock weights 加入後續 mixed pool。玩家擊殺數不是首版首次出場門檻。
- Director 先依時間、已完成 debut 與 pending debut 求出 definition，再使用該 definition 的完整 broad-phase radius 驗證 spawn candidate；不得先找一個位置再換成 footprint 不同的怪物。
- 所有選擇與重試保持 seeded、穩定且可重現。找不到合法位置時延後，不得強塞進視野、障礙物或其他敵人的 footprint。
- 精確最早登場時間、解鎖後權重、spawn cadence 與速度只存在 validated content，不複製到本文或 Director constants。

## 3. `Z` — ZOMBIE

### Body

- 顯示文字：`Z`
- Glyph Cell 數：1
- 動態觸發：Creature 正在移動時
- `maximumSpeed`、`bodyMotionCycleDurationMs`、幅度與節拍只由 prepared ZOMBIE definition 提供。

### Motion identity

- 以字形底部為近似軸心，做小幅且不對稱的左右蹣跚。
- 節拍是「緩慢失衡 → 快速撐回 → 短暫站穩 → 另一側失衡」，不是等速鐘擺。
- Runtime 同時計算 Glyph rotation 與中心位置補償，使底部支點在 root locomotion 之外保持近似固定。
- Glyph hitbox 目前為圓形，因此 rotation 不改變碰撞形狀；位置補償後的圓心仍是權威碰撞位置。
- 移動強度降到零時回到中性 anchor 與零旋轉，不保留漂移。

## 4. `BO` — BONE

### Body

- 內容身分：`BO`
- 顯示排列：

  ```text
  O
  B
  ```

- `O` 在上作為頭部，`B` 在下作為軀幹；兩格以直向 canonical adjacency 相連，並以各自的 Layout Anchor 參與權威 hitbox 與 topology。
- Glyph Cell 數：2
- 動態觸發：Creature 正在移動時
- `maximumSpeed`、`bodyMotionCycleDurationMs`、幅度與節拍只由 prepared BONE definition 提供。

### Motion identity

- `B`、`O` 使用錯開的短促節拍，各自做很小的 position／rotation 點動。
- 主節奏採雙擊感：一個 Cell 先碰一下，另一個 Cell 回應，再留出短暫空拍。
- 兩個 Cells 不做完全相同、同方向、同時間的連續搖擺，避免整個單字像果凍。
- 直向排列只改變穩定 Layout Anchors 與 topology；既有 BONE motion groups、錯拍方式與每隻 instance 的 deterministic phase variation 都保持不變。
- 移動強度降到零時兩個 Cells 都回到中性姿態。

## 5. `BAT`

### Body

- 顯示文字：`BAT`
- Glyph Cell 數：3
- 動態觸發：Creature 處於 Active flight 時
- `maximumSpeed`、`bodyMotionCycleDurationMs`、幅度與節拍只由 prepared BAT definition 提供。

### Motion identity

- `A`、`T` 是主要拍翼 Cells，使用近乎同拍的上下點動；`T` 稍晚於 `A`，形成刻意錯拍而非完全機械同步。
- 一拍包含快速上提、短暫 hold、俐落下收與短收勢，不使用全程等速或柔軟正弦擺動。
- `B` 保持主體穩定，只允許很小的反向補償，不能跟著 `A`、`T` 做同振幅上下晃動。
- Cell 進入 `HUSK` 後仍跟隨相同 slot motion，直到整隻 BAT 進入 `COLLAPSING`。

## 6. `ROCK`

### Body

- Initial／neutral Body Blueprint 固定為：

  ```text
  RO
  CK
  ```

- Glyph Cell 數：4。
- 四個 occupied slots 形成穩定 2 × 2 canonical topology。`R`、`O`、`C`、`K` 各自保留同一個 Glyph ID、character、Durability、state 與 topology 身分；滾動不得交換資料、改寫 glyph frame 或重建 Cell。
- `maximumSpeed`、各 Cell 的 Max Durability、ROCK Material response、`fullRollDurationMs`、`poseHoldDurationMs` 與 Body Motion 幅度只由 prepared ROCK definition 提供。灰色 Appearance Profile 不得代替硬質 Material 行為。
- 動態觸發：Creature 具有足以確立水平方向的權威 root movement 時。

### Motion identity

- 往右移動使用順時針 rigid roll，四個穩定 Glyph 的中心依圓弧前往下一個 90° pose：

  ```text
  RO  →  CR  →  KC  →  OK  →  RO
  CK     KO     OR     RC     CK
  ```

- 往左移動使用完全相同路徑的反向播放：

  ```text
  RO  →  OK  →  KC  →  CR  →  RO
  CK     RC     OR     KO     CK
  ```

- 以上矩陣是 exact pose contract。中間過渡是連續權威位置，不是瞬間換字；方向反轉時從當前 roll phase 倒播，不得跳到另一幀。
- `fullRollDurationMs` 只定義最大水平 movement intensity 下，四段 active 90° 旋轉合計花費的時間，不包含任何落點停頓；因此單段 active 旋轉時間為 `fullRollDurationMs / 4`。
- `poseHoldDurationMs` 獨立定義每次抵達合法 90° pose 後的停頓時間，包含回到 neutral `RO／CK` 的落點。完整四段動作加停頓的 cadence 為 `fullRollDurationMs + 4 * poseHoldDurationMs`；調整停頓不得改變 active 旋轉速度，調整旋轉時間也不得按比例改寫停頓。
- 每個 90° 落點的 hold 讓翻轉快速、帶重量並乾淨收勢，不使用柔軟的等速 sine rotation。字形保持正立以維持可讀性，滾動感來自四個 Glyph 中心繞 root 的位置變化。
- 水平分量降至 direction dead zone 時停止推進 roll phase，完成正在進行的短收勢並停在最近合法 90° pose；接近垂直移動不得因微小 `velocityX` 正負變化反覆切換方向。
- Body Motion 只寫 pose offset／rotation channel，不覆蓋 Layout Anchor 或 Material deformation。Active Husk 與 Living Cell 使用同一 roll track，直到整隻 ROCK 進入 `COLLAPSING`。

## 7. `SNAKE`

### Body

- 穩定 Glyph 身分依序為 `S-N-A-K-E`，Glyph Cell 數為 5。
- `S` 永遠是唯一頭部。Neutral pose 讓 `S` 的 Layout Anchor 比 `NAKE` 水平基線微微抬高；canonical topology 仍保持同一條 `S-N-A-K-E` chain，視覺抬頭不得切斷 `S` 與 `N`。
- 往左時，畫面由左至右顯示 `SNAKE`，`S` 位於前方；往右時五個穩定 Glyph 的位置鏡像，畫面由左至右顯示 `EKANS`，`S` 位於右端前方。`E` 永遠不會取得 head role，鏡像也不得交換 character、Glyph ID、Durability 或 canonical topology。
- 鏡像前後的擠壓中心都是同一個穩定 `K` Glyph；不得依 facing、phase 或畫面上的左右順序把這個角色轉交給 `N`、`A` 或 `E`。
- 接近垂直移動時保留最後一個穩定水平 facing，不得在方向 dead zone 內反覆鏡像。
- `maximumSpeed`、各 Cell Max Durability、Material response、Body Motion cadence、抬頭幅度、`SNA` 群組壓縮距離、`E` 壓縮距離與 `K` 上抬距離只由 prepared SNAKE definition 提供；current authoring source 是 [`ordinarySnake.ts`](../../src/game/content/enemies/ordinarySnake.ts)。普通怪 `SNAKE` 不繼承 Boss `ANACONDA` 的可打斷／分段獨立活動規則。

### Motion identity

- 一個 cycle 依序表現：可讀的直線空拍 → 固定 `K` 擠壓快速收緊 → 極短 hold → 俐落拉直 → 乾淨 settle。
- `cycleDurationMs` 定義完整 locomotion beat；`squeezeStartRatio < squeezePeakRatio < squeezeHoldEndRatio < squeezeEndRatio` 定義空拍、收緊、hold 與拉直的 normalized 邊界。`turnDurationMs` 是獨立轉身時間，不得用 cycle 比例隱式換算。
- `segmentLength` 保持 neutral slots 的基準間距；`snaCompressionDistance`、`eCompressionDistance` 與 `kLiftDistance` 分別限制 `SNA` 群組沿 body axis 靠近 `E`、`E` 沿反方向靠近 `SNA` 及穩定 `K` 沿畫面 y 軸上抬的最大距離。這些參數都在 LOADING 驗證，fixed step 不解析字元或搜尋 topology。

| 穩定 Glyph 角色 | 擠壓 phase 的權威動作 |
| --- | --- |
| `S`、`N`、`A` | 共用同一個 body-axis translation 靠近 `E`；三者的內部間距與排列保持不變。 |
| `K` | 保持自己的 body-axis anchor，只取樣一個向上的 y-axis lift channel。 |
| `E` | 沿 body axis 從另一側靠近 `SNA`；不得被當成頭部或替代擠壓點。 |

- 左 facing 時 `SNA` 與 `E` 水平相向靠近；右 facing 時整組動作鏡像，但仍操作同一組 `S-N-A`、同一個 `K` 與同一個 `E`。擠壓不得沿 chain 移動，不得改變 slot 順序、讓 Glyph 互相穿越，也不得讓每個 Cell 各自取樣 sine wave。
- 水平 facing 反轉時使用連續的 Runtime-owned pose interpolation 完成鏡像。轉身全程仍由 `S` 擔任頭部、由同一個 `K` 擔任擠壓中心；不得瞬間鏡像、讓 Glyph 穿越整個 body，或只在 renderer 假造轉身。
- 停止移動時完成當前短收勢並回到對應 facing 的 straight neutral pose；重新移動從穩定 pose 開始，不累積上一次 offset。
- Active Husk 與 Living Cell 使用同一 slot motion；`S` 成為 Husk 不會把 head role 轉交給 `E`，整隻 SNAKE 只有在所有 Cells 都成為 Husk 後才進入 `COLLAPSING`。

## 8. 暗色基礎色系與發亮階級

首批普通敵人使用不同 Appearance Profile。每個 profile 的暗色基礎色獨立，共用的則是 ordinary-enemy 發亮／視覺強調階級：

本文所稱「明度」是基礎 palette 從暗到淺的色調屬性；「亮度／發亮階級」是受 Gameplay state 控制的視覺強調程度。普通怪應降低前者並以適度彩度保留物種辨識，同階級只共用後者。

| 物種 | 基礎色系身分 | 發亮階級 |
| --- | --- | --- |
| `Z` | 偏暗綠色系 | Ordinary |
| `BO` | 暗骨白／偏暖中性灰色系 | Ordinary |
| `BAT` | 偏暗、彩度稍高的深紫色系 | Ordinary |
| `ROCK` | 偏暗、與 BONE 區隔的冷岩灰色系 | Ordinary |
| `SNAKE` | 偏暗、具辨識彩度的青綠色系 | Ordinary |

- 基礎色相、彩度與明度屬於物種 palette；發亮強度屬於 presentation tier。兩者不得再用一個最終 tint 混成同一概念。
- `HEALTHY`、`DAMAGED`、`HUSK` 與短暫受擊峰值分別是 semantic presentation roles；五個物種在對應 role 使用相同 ordinary 發亮階級與狀態順序，不代表其基礎色或疊加背景後的有效亮度必須接近一致。
- 普通怪的常態基礎色應維持偏暗。有色色系可使用稍高彩度保留辨識度；`BO` 以暗骨白／偏暖中性灰建立骨頭身分，`ROCK` 以偏冷且更沉重的岩灰建立石材身分，兩者不能退化成無法區分的同一灰階。`SNAKE` 的青綠也不得為了跨物種亮度對齊被洗成粉彩或低彩度。
- 直接受擊發亮、局部粒子與其他 primary impact feedback 必須從被擊中物種自己的色系解析。`Z` 保持綠色系、`BO` 保持骨白系、`BAT` 保持紫色系、`ROCK` 保持冷岩灰系、`SNAKE` 保持青綠系，不切換成一個全域共用的命中色。Damage Spread 是 secondary feedback 的明確例外：只在擴散實際造成傷害的目標上，改用來源 `PLAYER_ATTACK_VISUAL_ROLE` 的 accent 色系；它不改寫該怪物後續的 base／primary palette。
- 色系不屬於 Glyph Material。不同色系不得靠複製只改 tint、物理參數完全相同的 Material 實作。
- `SLIME` 使用暗而飽和的綠色基底與 Boss 發亮階級；相同 role 的強調程度比普通怪稍高，但仍低於玩家攻擊，且不得靠淺綠色基底偽造 Boss 階級。
- 精確 color、alpha、基礎色範圍、發亮強度、狀態曲線與受擊峰值只由 `src/game/content/visuals/prototypeCombatVisualTheme.ts` 的集中設定提供，本文、creature definitions 與 renderer 不重複數值。該 authoring config 的所有顏色使用 `#RRGGBB`；prepared content 才保存一次轉換後的 numeric tint。

## 9. Runtime 熱路徑限制

Body Motion 的首要目標是保留節奏辨識度，同時讓成本在 many-cell 場景中可預測：

1. LOADING／content preparation 先依 `bodySlotId` 編譯 motion groups 與必要參數；fixed step 不解析字串、不查角色名稱，也不建立 slot maps。
2. 每個 active creature 每個 fixed step 只計算一次 normalized phase、movement intensity 與 deterministic instance phase offset。
3. 每個 motion group 只取樣一次 keyframe／easing transform，再套用至該 group 的 Cells；不得對同組的每個 Cell 重算相同曲線。
4. 熱路徑不得配置暫時 object、array、closure 或 iterator result，不得執行 topology search，也不得逐 Cell 取亂數。
5. 若姿態需要 `sin`／`cos`，每個 creature／motion group 每步最多計算一次並重用結果；不得對大型 body 的每個 Cell 重複計算相同三角函數。
6. Body Motion 的時間複雜度上限為 `O(active creatures + animated glyphs)`，不得掃描不屬於該 owner 的 Glyph。
7. Body Motion 最大 position offset 必須編入 creature broad-phase margin，避免動畫中的輪廓移出 spatial query 範圍。
8. Rendering 沿用 Glyph Atlas、batched particles 與 view pool，只增加必要的 snapshot position／rotation 數值；不得為每隻怪建立專屬 Container、Ticker、Text 或暫時 display objects。
9. 每隻 ROCK 每步只取樣一次 signed roll phase 與一組共用 rigid-turn transform，再線性套用到四個 slots；不得逐字元重新計算相同三角函數。
10. 每隻 SNAKE 每步只取樣一次 normalized phase、facing、turn progress 與 squeeze amount；重用一個 `SNA` 群組 translation、一個 `E` translation 與一個 `K` y-axis lift，再線性套用到固定五個 slots。不得執行 topology search、逐 Cell 搜尋擠壓點或重複取樣相同曲線。

效能驗證沿用 `AGENTS.md` 的 ordinary-combat 與 Boss-stress populations，並觀察 body-motion simulation time、animated Glyph count、render sync time 與 frame p95。若需要降級，先降低純視覺粒子或非 Gameplay effect；不得關閉權威姿態、縮小 hitbox，或讓 renderer 與碰撞採用不同位置。

Runtime diagnostics 同時保留累積工作量與最近一次 Body Motion step 的觀測值。`bodyMotionSimulationTimeMs`、`bodyMotionEvaluationCount`、`bodyMotionGlyphUpdateCount` 用於整局累積；`bodyMotionStepTimeMs`、`bodyMotionActiveCreatureCount`、`bodyMotionActiveGlyphCount` 描述最近一次執行，不得把累積計數誤當成當前 active population。

[`ordinaryEnemyStress.test.ts`](../../tests/performance/ordinaryEnemyStress.test.ts) 使用 `AGENTS.md` 約定的兩級 population，分別量測權威 Body Motion、Render Snapshot 與 Pixi pooled-layer sync，並確認 warm-up 後不再產生 view-pool miss。這是可重現的 headless regression harness，不等同完整瀏覽器 GPU frame；frame p95 與 draw calls 仍必須在約定的 1080p 實機平台量測，不得用 Node 測得的 snapshot／pool 時間冒充。

## 10. 必要驗證

純規則測試至少覆蓋：

- 同一 phase、movement intensity 與 instance offset 永遠產生相同 transform。
- 跨越多個 cycle 後仍回到相同基準，不累積 position／rotation 漂移。
- `Z` 的底部支點在允許誤差內保持固定，且停止移動時回正。
- `BO` 的 `O` 永遠位於 `B` 上方並形成直向 topology；排列更新後兩個 Cells 仍使用既有不同節拍，停止移動時都回到中性姿態。
- `BAT` 的 `A`／`T` 執行主要拍翼，`B` 只做較小反向補償。
- `ROCK` 的四個 90° poses 精確符合本文矩陣，左右方向互為反向且轉向不跳格；滾動不改變 Glyph ID、character、Durability 或 canonical topology。
- `ROCK` 的 active 旋轉與 pose hold 分別服從 prepared `fullRollDurationMs`、`poseHoldDurationMs`；延長 hold 不得拖慢單次翻轉，修改 full roll 時間也不得縮放 hold。
- `ROCK` 在 direction dead zone 內收至合法 pose，不因微小水平速度雜訊反覆翻轉。
- `SNAKE` 的 `S` 永遠保持 head role；往右鏡像後顯示 `EKANS` 但 `E` 不成為頭，canonical topology 仍是 `S-N-A-K-E`。
- `SNAKE` 在 squeeze phase 中讓 `S`、`N`、`A` 取得同一個沿軸 offset 並保持內部間距，`E` 從另一側靠近，且只有同一個穩定 `K` 取得主要 y-axis lift；左右 facing 皆不改變這個分工。
- `SNAKE` 的轉身與伸展使用連續權威位置，不存在沿 chain 移動的擠壓點，停止後回到對應 facing 的 straight pose。
- Active Husk 與 Living Cell 使用同一 slot motion；`COLLAPSING` 不再執行戰鬥用 Body Motion。
- 相同 seed、Gameplay time、completed debut 與 pending debut state 產生相同 eligible enemy selection，且 failed spawn candidate 不可能跳過 `Z → BO → BAT → ROCK → SNAKE` 的首次出場順序。

Director 整合測試還必須從實際 spawn path 證明 pending debut 只在合法 candidate 成功 commit 後前進，並證明全部物種 debut 後的 mixed sequence 對相同 seed 可重現；不得只測 progression pure function 而跳過 candidate validation 與 commit 邊界。

色系身分、暗色基底、受擊 feedback 與跨角色亮度上限改由瀏覽器實機調校確認，不作為 Runtime content preparation 或單元測試拒絕合法 `#RRGGBB` 色碼的條件。

## 11. 後續調校項目

- 各 Creature Definition 的 `maximumSpeed`、Max Durability、`contactDamage`、XP reward、collapse timing 與 Material response 都是獨立 validated content；本文不複製 current defaults。
- 每種 debut 的 `earliestAppearanceTimeMs`、首次登場後的 mixed-pool weights 與 spawn cadence 需透過實機節奏調校，但不能改變固定首次出場順序或 successful-commit guard。
- 各 Body Motion profile 的 cycle、position amplitude、rotation angle、direction dead zone、hold／settle 長度與 movement-intensity curve 仍需實機微調；調整值只進入對應 authoring definition。
- SNAKE root locomotion 第一版可先保持既有追蹤速度語意。若 Body Motion 實機看起來像等速滑動，再評估 content-defined、與同一 phase 同步的速度 envelope；不得由 renderer 假造 Gameplay 頓點。
- 是否需要依 profiling 將 rotation-enabled Glyph views 分到獨立 batch；未量測前不增加額外 scene layers。
