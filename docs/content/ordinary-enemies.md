# Ordinary Enemies — Spawn Progression, Body Identity, and Motion

> 狀態：首版 multi-enemy progression、權威 Body Motion、rotation rendering、`BO` 直向 Body Blueprint，以及暗色基礎 palette／發亮階級分離的 Appearance Profile 皆已實作。集中 theme 已改用 `#RRGGBB` authoring strings，並在 content preparation 一次轉換成 numeric tint。本文列出的首輪數值是可調 content defaults，不是永久產品不變量。

本文定義首批普通敵人 `Z`、`BO`、`BAT` 的文字身分、Body Blueprint、色系、首次出場順序、權威 Body Motion 與效能契約。跨怪物共用的 Glyph 生命、Husk、碰撞、視覺階級與效能規則仍以 [`spec.md`](../../spec.md) 與 [`AGENTS.md`](../../AGENTS.md) 為準；玩家接觸受傷的接受、護盾與無敵規則見 [`player-survival.md`](player-survival.md)。

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
Stage 1: Z
Stage 2: BO
Stage 3: BAT
```

- 初始怪群先由 `Z` 建立最低複雜度的壓力。
- `BO` 只能在 `Z` 已進入其初始階段後登場。
- `BAT` 最後加入，不得在 `BO` 之前首次出現。
- Director 先用 content-defined progression 求出 eligible definitions，再做 seeded selection。
- 必須先選定 definition，才使用該 definition 的完整 broad-phase radius 驗證 spawn candidate。
- Spawn candidate 失敗只代表本次生成延後或跳過，不得為了湊出指定種類而強塞進視野、障礙物或其他敵人的 footprint。

首版以「成功 commit 的普通怪數量」切換互斥階段，spawn candidate 失敗不增加計數：

- successful spawn count `0–7`：只生成 `Z`。
- successful spawn count `8–15`：只生成 `BO`。
- successful spawn count `16+`：只生成 `BAT`。

這些門檻與互斥混合方式是首輪 prototype defaults，後續可改成 content-defined weighted pools；首次出場順序 `Z → BO → BAT` 仍不可被跳過。

## 3. `Z` — ZOMBIE

### Body

- 顯示文字：`Z`
- Glyph Cell 數：1
- 動態觸發：Creature 正在移動時
- 首版 maximum speed：40 world units/s
- 首版 motion cycle：620 ms

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
- 首版 maximum speed：56 world units/s
- 首版 motion cycle：440 ms

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
- 首版 maximum speed：72 world units/s
- 首版 motion cycle：360 ms

### Motion identity

- `A`、`T` 是主要拍翼 Cells，使用近乎同拍的上下點動；`T` 稍晚於 `A`，形成刻意錯拍而非完全機械同步。
- 一拍包含快速上提、短暫 hold、俐落下收與短收勢，不使用全程等速或柔軟正弦擺動。
- `B` 保持主體穩定，只允許很小的反向補償，不能跟著 `A`、`T` 做同振幅上下晃動。
- Cell 進入 `HUSK` 後仍跟隨相同 slot motion，直到整隻 BAT 進入 `COLLAPSING`。

## 6. 暗色基礎色系與發亮階級

首批普通敵人使用不同 Appearance Profile。每個 profile 的暗色基礎色獨立，共用的則是 ordinary-enemy 發亮／視覺強調階級：

本文所稱「明度」是基礎 palette 從暗到淺的色調屬性；「亮度／發亮階級」是受 Gameplay state 控制的視覺強調程度。普通怪應降低前者並以適度彩度保留物種辨識，同階級只共用後者。

| 物種 | 基礎色系身分 | 發亮階級 |
| --- | --- | --- |
| `Z` | 偏暗綠色系 | Ordinary |
| `BO` | 暗骨白／中性灰色系 | Ordinary |
| `BAT` | 偏暗、彩度稍高的深紫色系 | Ordinary |

- 基礎色相、彩度與明度屬於物種 palette；發亮強度屬於 presentation tier。兩者不得再用一個最終 tint 混成同一概念。
- `HEALTHY`、`DAMAGED`、`HUSK` 與短暫受擊峰值分別是 semantic presentation roles；三個物種在對應 role 使用相同 ordinary 發亮階級與狀態順序，不代表其基礎色或疊加背景後的有效亮度必須接近一致。
- 普通怪的常態基礎色應維持偏暗。有色色系可使用稍高彩度保留辨識度；`BO` 以暗骨白／中性灰建立白色系身分，不靠大面積淺灰或純白取得辨識度。不得為了通過跨物種亮度誤差而把 `BAT` 或其他後期怪物洗成淺色、粉彩或低彩度。
- 直接受擊發亮、局部粒子與其他 primary impact feedback 必須從被擊中物種自己的色系解析。`Z` 保持綠色系、`BO` 保持白色系、`BAT` 保持紫色系，不切換成一個全域共用的命中色。Damage Spread 是 secondary feedback 的明確例外：只在擴散實際造成傷害的目標上，改用來源 `PLAYER_ATTACK_VISUAL_ROLE` 的 accent 色系；它不改寫該怪物後續的 base／primary palette。
- 色系不屬於 Glyph Material。不同色系不得靠複製只改 tint、物理參數完全相同的 Material 實作。
- `SLIME` 使用暗而飽和的綠色基底與 Boss 發亮階級；相同 role 的強調程度比普通怪稍高，但仍低於玩家攻擊，且不得靠淺綠色基底偽造 Boss 階級。
- 精確 color、alpha、基礎色範圍、發亮強度、狀態曲線與受擊峰值只由 `src/game/content/visuals/prototypeCombatVisualTheme.ts` 的集中設定提供，本文、creature definitions 與 renderer 不重複數值。該 authoring config 的所有顏色使用 `#RRGGBB`；prepared content 才保存一次轉換後的 numeric tint。

## 7. Runtime 熱路徑限制

Body Motion 的首要目標是保留節奏辨識度，同時讓成本在 many-cell 場景中可預測：

1. LOADING／content preparation 先依 `bodySlotId` 編譯 motion groups 與必要參數；fixed step 不解析字串、不查角色名稱，也不建立 slot maps。
2. 每個 active creature 每個 fixed step 只計算一次 normalized phase、movement intensity 與 deterministic instance phase offset。
3. 每個 motion group 只取樣一次 keyframe／easing transform，再套用至該 group 的 Cells；不得對同組的每個 Cell 重算相同曲線。
4. 熱路徑不得配置暫時 object、array、closure 或 iterator result，不得執行 topology search，也不得逐 Cell 取亂數。
5. 若姿態需要 `sin`／`cos`，每個 creature／motion group 每步最多計算一次並重用結果；不得對大型 body 的每個 Cell 重複計算相同三角函數。
6. Body Motion 的時間複雜度上限為 `O(active creatures + animated glyphs)`，不得掃描不屬於該 owner 的 Glyph。
7. Body Motion 最大 position offset 必須編入 creature broad-phase margin，避免動畫中的輪廓移出 spatial query 範圍。
8. Rendering 沿用 Glyph Atlas、batched particles 與 view pool，只增加必要的 snapshot position／rotation 數值；不得為每隻怪建立專屬 Container、Ticker、Text 或暫時 display objects。

效能驗證沿用 `AGENTS.md` 的 ordinary-combat 與 Boss-stress populations，並觀察 body-motion simulation time、animated Glyph count、render sync time 與 frame p95。若需要降級，先降低純視覺粒子或非 Gameplay effect；不得關閉權威姿態、縮小 hitbox，或讓 renderer 與碰撞採用不同位置。

## 8. 必要驗證

純規則測試至少覆蓋：

- 同一 phase、movement intensity 與 instance offset 永遠產生相同 transform。
- 跨越多個 cycle 後仍回到相同基準，不累積 position／rotation 漂移。
- `Z` 的底部支點在允許誤差內保持固定，且停止移動時回正。
- `BO` 的 `O` 永遠位於 `B` 上方並形成直向 topology；排列更新後兩個 Cells 仍使用既有不同節拍，停止移動時都回到中性姿態。
- `BAT` 的 `A`／`T` 執行主要拍翼，`B` 只做較小反向補償。
- Active Husk 與 Living Cell 使用同一 slot motion；`COLLAPSING` 不再執行戰鬥用 Body Motion。
- 相同 seed／progression state 產生相同 eligible enemy selection，且首次出場順序不可能跳過 `Z → BO → BAT`。

色系身分、暗色基底、受擊 feedback 與跨角色亮度上限改由瀏覽器實機調校確認，不作為 Runtime content preparation 或單元測試拒絕合法 `#RRGGBB` 色碼的條件。

## 9. 後續調校項目

- `Z`／`BO`／`BAT` 目前 maximum speed 分別為 `40／56／72`；各 Creature Definition 的 `contactDamage` 是獨立可調 content，本文不複製其 default。
- Stage 1／2／3 目前以 successful spawn count `0／8／16` 切換且互斥；是否改用時間、事件門檻或解鎖後混合先前種類仍可調整。
- 各動作目前使用 `620／440／360 ms` cycle；position amplitude、rotation angle、hold 長度與 movement-intensity curve 仍需實機微調。
- 是否需要依 profiling 將 rotation-enabled Glyph views 分到獨立 batch；未量測前不增加額外 scene layers。
