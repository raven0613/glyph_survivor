# SLIME Boss Content Sheet

> 狀態：M4 已完成 Slime Phase、分體、重新聚合與 Encounter Death；本文已納入全怪物共用的 `HEALTHY → DAMAGED → HUSK` 契約。暗色基礎 palette 與 Boss 發亮階級分離的 `SLIME_BOSS` Appearance Profile 已實作；集中 theme 已改用 `#RRGGBB` authoring strings，並在 content preparation 一次轉換成 numeric tint。玩家生存契約已移至 [`player-survival.md`](player-survival.md)，Runtime implementation 尚未完成；Boss 主動攻擊仍屬後續里程碑。

本文是第一隻 Boss `SLIME` 的專屬內容設定。跨怪物共用的生命、Glyph、分裂守恆與效能規則仍以 [`spec.md`](../../spec.md) 與 [`AGENTS.md`](../../AGENTS.md) 為準；玩家接觸受傷、護盾與死亡則以 [`player-survival.md`](player-survival.md) 為準；Boss Modifier reward、Volatile structural ordering與Disconnected reassembly latch以 [`run-modifiers.md`](run-modifiers.md) 為準。不要把本文的史萊姆數值搬進 `AGENTS.md`。

本文中的欄位名稱是預定的內容契約名稱。正式實作時可依 TypeScript 型別微調命名，但不得改變其語意或把它們變成第二套可變 HP。

## 1. 內容摘要

| 欄位 | 首版設定 |
| --- | --- |
| `contentId` | `boss.slime.prototype` |
| `contentVersion` | `1` |
| 分類 | Boss |
| 字元範圍 | Printable ASCII |
| `requiredGlyphs` | `S`, `L`, `I`, `M`, `E`, `O` |
| 初始 Body Blueprint Cells | 50（48 個身體格、2 個眼睛格） |
| `totalMaxDurability` | 70，僅供 LOADING 編譯與驗證 |
| 初始生命狀態 | 每格 Current Durability 等於 Max Durability，狀態為 `HEALTHY` |
| 耐久分布 | `CENTER_HARD` authored strict band |
| 預設 Material | `SLIME` |
| Appearance Profile | `SLIME_BOSS` semantic role |
| 最大移動速度 | 60 world units/s |
| 接觸傷害 | 由 prepared Boss Definition 的 `contactDamage` 提供 |
| 正式擊敗獎勵 | Encounter-level XP reward，加上一次 Run Modifier reward |
| 分體固定基準 | 根史萊姆最初設定的 50 Cells |
| 獨立分體門檻 | `ceil(50 × 0.30) = 15` 個 Living Cells；15 格也算通過 |

## 2. 載入與生成責任

LOADING 階段由 GameHost 協調兩條互不反向依賴的工作：

- Pure content compiler 驗證並編譯 Body Blueprint、耐久圖與行為參數，產生不可變 prepared definition 及 `requiredGlyphs`；它不得 import PixiJS。
- Rendering bootstrap 依 `requiredGlyphs` 準備共用 Atlas frames 與 View Pool；它不得建立或修改 Gameplay state。
- GameHost 等兩者都成功後才可進入 READY；任一路徑失敗都不得啟動部分模擬。

真正的 Creature、Glyph ID、Current Durability、位置與行為狀態，必須在 Runtime 收到生成事件時才建立。LOADING 失敗時不得使用部分編譯完成的史萊姆進入 READY。

`totalMaxDurability` 是 authoring budget，不是 Runtime HP。編譯完成後，權威生命只存在各 Glyph Cell 的 `currentDurability` 與 `maxDurability`；史萊姆總 HP 永遠是它們的唯讀加總。

## 3. 固定 50 格 Body Blueprint

首版中性形狀如下。編譯器以實際 marker 數量為準，不相信註解中的手算數字；每列固定為 14 columns。

下列引號只用來保留前後空白，不屬於 mask 資料：

```text
"    XXXXXX    "
"  XXXXXXXXXX  "
"XXXXoXXXXoXXXX"
" XXXXXXXXXXXX "
"   XXXXXXXX   "
```

總數：`6 + 10 + 14 + 12 + 8 = 50`。

Marker 定義：

- `X`：一般身體 slot。
- `o`：眼睛 slot；它仍是完整、可受傷的 Gameplay Glyph Cell。
- space：沒有 slot。

編譯後每個 occupied slot 都取得穩定 `slotId`、canonical grid coordinate 與 row-major `sequenceIndex`。包含 `o` 在內的每個 occupied slot 都先由 `sequenceIndex` 取得重複的 `baseCharacter`：`S → L → I → M → E`；Eye role 再以 presentation override 顯示 `O`。如此 Eye role 被移除時，該 Cell 能確定性地恢復自己的 `baseCharacter`。

形狀變形不得增加、刪除或複製 slot。寬扁、直立與中性形狀都必須是同一批 50 個 `slotId` 的不同 layout anchors。

## 4. 固定 70 點耐久分布

耐久圖與 Body Blueprint 使用相同 5 × 14 grid：

下列引號同樣不屬於耐久圖資料：

```text
"    111111    "
"  1122222211  "
"11122222222111"
" 111222222111 "
"   11111111   "
```

- `1`：該 Cell 的 `maxDurability = 1`。
- `2`：該 Cell 的 `maxDurability = 2`。
- space：必須與 Body Blueprint 的空位完全一致。

分布結果：

- 外圍 30 Cells × 1 = 30。
- 中央 20 Cells × 2 = 40。
- Total Max Durability = 70。

這是「中心硬、外圍軟」的可閱讀分布。兩個初始 Eye slots 都落在中央耐久帶，因此初始 Max Durability 為 2，但這只是位置帶來的結果，不是眼睛加成。

所有初始可見 Cell 至少要有 1 點 Max Durability。額外 20 點耐久只加厚指定 Cells，不得建立第 51 格，也不得在 Runtime 保留一個可另外扣除的 70 HP 欄位。

分裂、重排與蠕動都不得重新執行耐久分配器。Glyph ID 一旦建立，它的 Current／Max Durability 就跟著該 Glyph 移動。

每格生命狀態由 Current／Max Durability 決定：

- `HEALTHY`：`currentDurability === maxDurability`。
- `DAMAGED`：`0 < currentDurability < maxDurability`。
- `HUSK`：`currentDurability === 0`；不再具有生命值，也不再接受 Durability 傷害。
- Living Cell 是 `HEALTHY` 與 `DAMAGED` 的合稱。`maxDurability = 1` 的 Cell 可直接由 `HEALTHY` 進入 `HUSK`，不得為了強制顯示中間態而增加耐久。

`HUSK` 不是被刪除的 Glyph。它保留 Glyph ID、owner、character／frame、Max Durability、layout anchor、deformation 與碰撞資料，以低亮度繼續構成史萊姆的完整輪廓 hitbox。史萊姆 Current HP 只加總 Living Cells 的 Current Durability；Max HP 仍加總所有 Cells 的 Max Durability。

## 5. 眼睛規則

- 眼睛不是弱點，沒有傷害倍率、命中獎勵、AI、階段或死亡觸發。
- 眼睛是正常 Gameplay Glyph Cells，因此可以受傷並被真正擊退；耐久歸零時進入 `HUSK`，仍以低亮度保留在完整輪廓中，不會消失。
- 眼睛套用所在 Cell 原本的 Durability 與 `SLIME` Material，不建立特例。
- Eye Cell 進入 `HUSK` 時不補眼、不恢復耐久；在一般受傷與 morph 中保留原 Eye presentation role。只有明確的 split／reassembly commit 可以重排外觀並清除其 presentation override，清除後仍以自己的 `baseCharacter` 低亮顯示。
- 每個獨立分體完成 ownership 分配後，從該身體既有的 Living Glyph 中決定最多兩個眼睛。只改顯示角色／Glyph frame；不得建立新 Glyph，也不得改變 ID、Current Durability、Max Durability 或 Material。
- 上一項是 split／reassembly commit 時的明確外觀重排，因此可能讓另一個既有 Living Glyph 顯示成眼睛；原本的 Eye Husk 仍是 `HUSK`，沒有被替換或復活。
- 重新指定前先清除未入選 Cells 的 Eye presentation override，讓它們顯示既有 `baseCharacter`；不得把 Husk 改回 Living。
- 眼睛選擇必須是穩定、可重現的：優先選擇最接近 layout 內兩個 face target 的 Living Cells；距離相同時以較小 Glyph ID 決定。
- 少於兩個 Living Cells 時，只顯示仍可指派的眼睛數；沒有眼睛不影響生命或行為。

## 6. 移動與蠕動

- SLIME 的 `maximumSpeed` 只由 prepared Boss definition 提供。普通怪物具有各自獨立內容定義與 `Z → BO → BAT → ROCK → SNAKE` progression，不得假設所有普通怪共用同一速度；普通怪速度與出場語意以 [`ordinary-enemies.md`](ordinary-enemies.md) 為準。
- 一般 `RUNNING` 戰鬥中的移動採平滑、具阻尼的玩家追蹤，不允許瞬間改變 world position；玩家死亡進入 `DEATH_REVIEW` 後解除玩家 target，並依 [`player-survival.md`](player-survival.md) 改用平滑的無目標游走，不得繼續追向玩家死亡座標。
- 蠕動是 layout anchor 在中性、寬扁、直立形狀間的連續變形；不是 renderer 私自移動 Glyph。
- 同一個 Glyph ID 在所有 morph layouts 中都存在。形狀改變造成文字重新排成不同列，但不交換生命、不重新分配耐久。
- 眼睛使用同一批眼睛 Cells 跟隨 face targets 移動；一般 morph 不反覆挑選新眼睛。
- `worldGlyphPosition = creatureRootPosition + layoutAnchor + bodyMotionOffset + deformationOffset`。移動更新 root，蠕動更新 anchor，專屬 Body Motion 更新獨立 pose offset，受擊更新 deformation offset／velocity，各來源不可互相覆寫。首版 SLIME 的獨立 `bodyMotionOffset = 0`，其動態身分由蠕動 layout 提供；保留此層是為了與跨怪物共用座標契約一致。

首版三組 50-slot anchors 固定如下：

- 中性：`6 / 10 / 14 / 12 / 8` 五列，沿用第 3 節 blueprint。
- 寬扁：`10 / 14 / 14 / 12` 四列，眼睛位於第二列的第 5、10 格。
- 直立：`4 / 6 / 8 / 10 / 10 / 8 / 4` 七列，眼睛位於第三列的第 3、6 格。
- 完整 morph cycle 為 2,400 ms：`neutral → wide → neutral → tall → neutral`，每段 600 ms，使用 smoothstep easing。
- 初始 authored body 的 `authoredMorphStrength = 0.75`；每個 wide／tall anchor 只採用相對 neutral 位移的 75%，降低完整史萊姆移動時的穿插幅度。
- 阻尼追蹤 responsiveness 為 `4`；移動速度仍受 60 world units/s 上限約束。

這些數值是 M3 prototype 的首版調校基準；後續可以調整座標與時間，但不得以增減 Cells 代替視覺調校。

## 7. 受擊與 `SLIME` Material

- 每次攻擊必須分開計算 `Impact Cells` 與 `Damage Targets`。`Impact Cells` 是 DamageShape 幾何範圍內的所有輪廓 Cells，包含 `HEALTHY`、`DAMAGED` 與 `HUSK`；只要命中任一 Impact Cell，就算命中史萊姆完整 hitbox。
- 每個被命中的 body 分別解析 quota。Point-like attack 的 `targetQuota = 1`；AoE 的 `targetQuota` 等於 DamageShape 內命中該 body 的不同輪廓 Cell 數量。每個 Living Cell 在同一次攻擊最多成為一次 Damage Target。
- Damage Targets 優先使用 Impact Cells 中的 Living Cells。若 quota 尚未用完，每個 Husk Impact source先依該武器的authoritative forward traversal direction尋找前方第一個Living Cell；只有該方向已鑽通時，才fallback至最近canonical-topology frontier。完整選擇與tie-break遵守 [`weapon-system.md`](weapon-system.md) 與 [`AGENTS.md`](../../AGENTS.md) 的共用damage contract。
- 若整個 body 的 Living Cells 少於 quota，剩餘 quota 直接捨棄，不得把多次傷害疊到最後一格，也不得跨 owner 複製命中次數。遠端 direct target在命中步只建立包含stable source／target／path／reserved damage的pending transfer，不得立即扣除Durability。
- 受擊閃光、deformation impulse 與局部粒子只作用在 DamageShape 內的 Impact Cells，無論它們是 Living 或 Husk。因directional topology transfer而在範圍外被選中的遠端Damage Target，必須等Runtime-owned逐Cell pulse抵達才扣Durability並顯示target hit response；中間path Cells不承受damage、Material impulse或primary feedback。
- Impact Cell 的 collision position 跟著權威 deformation 位移。Husk 的 Current Durability 永遠維持零，但仍可呈現局部受擊反應，之後由 `SLIME` spring 被動回到自己的 layout anchor。
- 當外力停止，即使 Creature root 沒有移動，Living Cell 與 Husk 都以彈簧式恢復回當前 layout anchor。
- Creature root 正在移動或蠕動時，Cell 追逐的是更新後的 anchor，不是舊 world position。
- Husk 不因回彈、受擊特效或 layout recovery 而復活。只有 Encounter 進入 `COLLAPSING` 後，才可把不再參與 Gameplay 的 Cells 轉為短命、純渲染碎片。
- SLIME 的位移幅度高、回復具彈性、重新聚合傾向強；普通怪 ROCK 與未來 GOLEM 等硬材質則使用較低位移與較剛性的回復。

M3 首版 `SLIME` Material 數值為：

- knockback impulse：`220` world units/s。
- spring strength：`22`。
- damping：`7`。
- maximum deformation offset：`34` world units。
- hit flash duration：`80 ms`。

這些 response 數值透過 Material definition 套用，不依 `contentId` 寫物種分支。DamageShape 內所有狀態的 Impact Cells 都可接受 Material impulse／flash timing；遠端 Damage Target 不接受這些局部 response。直接受擊 flash 的色系與亮度由 Appearance Profile 和集中 Battlefield Visual Theme 解析，不得塞進 Material 或 renderer 的物種分支。Damage Spread 的 secondary feedback 不屬於 Slime primary response，改由來源 `PLAYER_ATTACK_VISUAL_ROLE` 的 accent 色系解析。

## 8. 顏色與 Glyph Atlas

史萊姆使用 `SLIME_BOSS` Appearance Profile。本文只保留可驗證的色彩語意，不保存 CSS color、Pixi numeric tint、alpha 或亮度數字：

| 顯示角色 | 色系與階級契約 |
| --- | --- |
| Living body | 使用暗而飽和的史萊姆綠色基底與 Boss active 發亮階級 |
| Durability 降低 | 留在史萊姆綠色系，依 prepared durability／state mapping 單調降低 |
| 短暫受擊閃光 | 留在史萊姆綠色系，使用 Boss impact tier |
| Damage Spread feedback | 僅在擴散實際造成傷害時，短暫使用來源玩家攻擊 role 的 accent 色系；不改寫史萊姆 base palette |
| Eye idle accent | 使用獨立 Eye Accent semantic role，但不改變生命、判定或階級上限 |
| `HUSK` | 留在史萊姆色系的低亮 Husk tier，輪廓仍可讀 |

- 史萊姆的基礎色相／彩度／明度與 Boss 發亮強度是分離參數。相同 semantic role 下，史萊姆使用比 ordinary tier 更強的亮度強調，但不要求其基礎色或最終有效亮度與普通怪做固定差值，也不得把本體洗成淺綠或低彩度。
- 史萊姆與普通怪的受擊峰值仍必須低於玩家攻擊；這類跨類別上限才使用疊加實際背景後的有效亮度驗證。
- 上述色彩與亮度關係是瀏覽器視覺調校目標；Runtime 只驗證 `#RRGGBB` 格式與 theme 結構，不因合法色碼的彩度、明度或有效亮度拒絕載入。
- Eye Accent 只是一個 presentation role，不代表弱點、傷害倍率或特殊判定。Eye Cell 被命中時使用史萊姆綠色系的 Boss impact response，結束後才回到符合其生命狀態的 Eye Accent；Eye Husk 不得因此恢復或消失。
- 受擊閃光只是一個短暫 render response，不能取代 Durability、權威 displacement 或 Material recovery。
- Husk 的集中設定可以調整可讀性，但不得把 Husk 隱藏、移出 render snapshot 或排除於完整輪廓 hitbox。
- 所有實際色值、alpha 與狀態亮度映射只存在 `src/game/content/visuals/prototypeCombatVisualTheme.ts`，不再複製到本文、Boss definition、Material 或 render adapter。該 authoring config 的顏色一律使用 `#RRGGBB`，並在 content preparation 轉成 prepared numeric tint；Material 仍可擁有受擊 response 的時長，但不能擁有物種色值。

首版字元只需共用 Printable ASCII Atlas。不得為每個 Cell 建立一個 PixiJS `Text`／`HTMLText`；高量 Glyph 使用共用 Atlas frame 與 pooled view。

## 9. 出現時機與接觸傷害

- 根史萊姆與第一波怪一起出現。
- 正式觸發語意是：依普通怪 progression 生成的第一隻 `Z` 成功 commit spawn 時，Runtime 發出一次性的 `FIRST_WAVE_STARTED`；Boss 專用 spawn request 在下一個允許消費 structural events 的明確 boundary 排入，不能在仍迭代 spawn collection 時直接改動它。這仍屬於同一波生成。
- 初始 `Z` spawn 候選失敗時不算第一波開始，也不得因此生成史萊姆；不得跳過 `Z` 改用任何尚未完成首次登場的後續 definition（`BO`、`BAT`、`ROCK` 或 `SNAKE`）觸發 Boss。
- 史萊姆不走普通怪 director 的一般生成路徑。首版在第一波同側、鏡頭外的合法位置生成；找不到合法位置時延後 Boss request，不得強塞進視野或障礙物。
- 史萊姆使用 seeded 0.3–0.5 秒文字聚合生成階段；Runtime 決定何時轉為 Active，renderer 只顯示狀態。

Prepared Slime definition 的 `contactDamage` 是此 Boss 接觸傷害的唯一可調來源，本文不複製其 default。一次 owner contact 只產生一個候選 incoming-damage event，不按接觸 Glyph 數量或每個 fixed step 直接重複扣血；事件是否被接受、護盾 routing、global invulnerability 與回復計時均由 [`player-survival.md`](player-survival.md) 定義。

玩家接觸判定只在 Slime body 處於 `ACTIVE` 或 `REASSEMBLING` 時啟用，並使用 Living 與 Husk 共同構成的完整史萊姆輪廓；文字聚合生成期間不造成玩家接觸傷害，也不得因局部 Cells 進入 Husk 而縮小玩家面對的接觸 hitbox。Encounter 進入 `COLLAPSING` 後停用 Gameplay collision。

## 10. 分體與重新聚合

### 10.1 固定門檻

每個根史萊姆在建立時固定保存：

```text
splitReferenceCellCount = root initial Body Blueprint count = 50
minimumIndependentLivingCellCount = ceil(50 × 0.30) = 15
```

所有後代都繼承相同的 `splitReferenceCellCount = 50`。不得依目前 Living 數量、該分體取得的數量或最新 layout 重新計算 30%，以免遞迴產生越來越小的獨立史萊姆。

Living connected component 有 15 格以上時可成為獨立史萊姆；「以上」包含正好 15 格。計數只看 Living Cell 數量，不看 Current／Max Durability 總和。

### 10.2 連通性

- 連通圖使用目前已 commit 的 canonical body layout grid，以四方向鄰接：上、下、左、右。
- 對角線不算連通。
- 只有 Husk 會切斷 Living 連通；暫時擊退、飛散、回彈或 morph 造成的 world-space 距離不會觸發分裂。
- DISCONNECTED 的 spacing loosen、ambient jitter與component hit shake同樣只是 [`run-modifiers.md`](run-modifiers.md) 定義的bounded render-only presentation；它們不得改寫史萊姆canonical coordinates、split component、precise hitbox或spring recovery target。
- 中性／寬扁／直立 morph layouts 共用同一份 topology；只有分體或重新聚合完成時，才可在 structural boundary 為新的 body layout commit 新 canonical coordinates 與 adjacency。
- 只在 Glyph 進入 `HUSK`、將 owner 標為 topology-dirty 時，於 Damage／Death 後的 structural boundary 重算；不得每個 fixed step 掃描所有史萊姆。
- 若該owner仍有Living Cells，且存在尚未解析、仍可能對它造成damage的Volatile reaction events，這次topology-dirty與split／reassembly structural commit必須保留到相關chains收斂；不得在跨tick wave中途改寫canonical adjacency。其他owner不受此defer影響。
- Owner已全Husk時仍依既有Encounter lifecycle進入`INACTIVE`或`COLLAPSING`，不因只剩presentation用途的Volatile events延後phase；但Runtime不得丟棄已授權的source-event sequence，正式`DEFEATED`／reward／cleanup仍須等待它解析完成。

### 10.3 Component resolution

1. 找出所有 Living connected components。
2. 若該 body 的 Living Cell 數為 0，此時沒有「最大 component」，也不執行重聚、layout 或 eye assignment。若 encounter 仍有其他 Living Cells，該 body 依第 10.4 節進入 `INACTIVE`；只有 encounter 全部 Cells 都是 Husk 才進入 `COLLAPSING`。
3. 若仍只有一個 component，不進行 split／reassembly layout commit，不重選眼睛；Husk 保留在這次局部壞死的位置，繼續構成輪廓。
4. 若有多個 components，將至少 15 格者列為 qualifying components。30% 以上包含正好 15 格。
5. 有 qualifying components 時，每一個都成為最終 body target；最大者保留原 Creature ID，其他 qualifying components 取得新的 Creature ID。大小相同時，以 component 中最小 Glyph ID 排序。至少兩個 qualifying components 時才算真正新增分體。
6. 沒有 qualifying component 時，以最大的 Living component 作為唯一重新聚合 target，並保留原 Creature ID。Creature 不因未達分體門檻而直接死亡。
7. 少於 15 格的 components 不消失、不轉成純粒子，也不損失耐久；它們重新指派給最近的最終 body target，並以 `SLIME` recovery 移向新 layout anchors。
8. 「最近」使用 structural boundary 當下的權威 world-space component centroid；距離相同時，以目標 component 的最小 Glyph ID 決定，確保結果可重現。
9. Living component 決定分體拓撲；每個 Husk Glyph ID 仍須確定性地歸屬最近的最終 body，但保持 `HUSK`、不得連通、不得計入 15 格，也不得恢復 Durability。
10. 每個最終 body 必須透過 pure deterministic `compileSlimeBodyLayout`，為自己既有的每個 Glyph ID 恰好產生一個 anchor 與 canonical topology position。重排時先保留 Cell 當下 world position 為 deformation offset，再由 Material recovery 合攏，避免瞬移。
11. 只有本節的多-component layout commit 完成後，才依第 5 節規則重新指定各最終 body 的外觀眼睛；一般單一 component 受傷不會讓眼睛漂移。
12. 若本局持有`DISCONNECTED`，在本次structural commit改寫canonical topology之前，先依最終pre-split Living components計算未受80%主要團塊規則保護的multiplier，並以stable Glyph ID保存reassembly latch；公式與status payload以 [`run-modifiers.md`](run-modifiers.md) 為準。

### 10.4 首版 child layout 與 Phase

- `compileSlimeBodyLayout` 將分配至同一 body 的 Living 與 Husk Glyph 分別依目前 canonical row、column、Glyph ID 穩定排序。
- 目標 anchors 從橢圓距離最接近中心的 grid positions 取樣，形成置中、緊密且略寬的圓潤形狀；相同輸入必須得到相同 layout。
- Living Glyph 優先取得由中心向外擴張的 anchors，因此 reassembly commit 後必須形成單一四方向連通區域；未達 15 Cells 的碎塊會從原 world position 真正聚合至這個區域。
- Husk 保留 ID、owner、Current Durability `0`、Max Durability 與唯一 anchor，但只配置在 Living 區域之外的侵蝕帶，不得重新切斷已聚合的 Living topology，也不恢復耐久。
- 這項 Husk 重排只發生在明確的 split／reassembly commit；一般局部受傷在 topology 尚未斷裂時仍保留局部壞死形狀。commit 後，Husk 可接受 `SLIME` spring recovery，被動回到自己的新 anchor。
- commit 前先記錄每個 Glyph 的 world position；新 root 與 anchor 建立後，差值寫入權威 deformation offset，因此 ownership／layout 改變當步不得造成畫面或碰撞位置瞬移。
- 新 body 的 face targets 位於形狀上方 40% 高度、中心左右各 20% 寬度。每個 target 只從保留／建立該 owner 的 core component 選最近 Living Glyph；未達門檻、正在聚回去的小碎塊不得取得眼睛。同距離取較小 Glyph ID，且同一 Glyph 不得同時成為兩眼。
- Split 後 body 進入 `REASSEMBLING`。此階段暫停 root 追蹤與 morph，但 Glyph 仍可碰撞、受傷，並由 `SLIME` spring 向新 anchors 聚合。
- 若Cell帶有本次episode的`DISCONNECTED_LATCHED` payload，`REASSEMBLING`期間的direct damage使用latched與目前topology計算結果中較高的multiplier。Ownership transfer、eye reassignment與layout recovery不得清除或複製該payload。
- 該latch的易傷presentation跟隨stable Glyph ID通過ownership／layout改寫；render-only鬆動以新body的resolved component presentation為準，不得讓舊owner留下一份重複overlay。
- 所有 Cells（包含 Living 與 Husk）的 offset 距離不超過 1 world unit 且速度不超過 5 world units/s 後，body 回到 `ACTIVE`；compiled body 以同一組 anchors 做寬扁／直立比例形變。
- Body正式回到`ACTIVE`時清除該reassembly episode的Disconnected latch，後續damage重新依最新canonical topology動態判定；Cell若先進入Husk則立即清除living-only latch。
- compiled body 的 `compiledMorphStrength = 1.4`，將基準比例差放大至 140%；首版 wide scale 約為 `(1.21, 0.65)`，tall scale 約為 `(0.65, 1.21)`，讓重組後的第二階段穿插幅度比先前明顯。
- Living Cells 為零但 Encounter 尚未結束的 body 進入 `INACTIVE`，不移動、不能提供 Damage Target，也不提前清除其 Glyph IDs；其 Husk 仍以低亮度構成完整輪廓，可命中並播放 DamageShape 範圍內的 impact effects。
- 15-Cell 門檻只決定 component 是否能在 split commit 當下取得新 owner。已合法建立的 child owner 日後即使剩餘少於 15 Cells，也不跨 owner 聚回 root 或其他 child；它只重新吸收自己之後產生的未達門檻碎塊。

Encounter phase 為 `ACTIVE → COLLAPSING → DEFEATED`。所有 child 共享根史萊姆的 `encounterId`、`rootBossId` 與 50-Cell split reference；只有 Encounter Current Durability 歸零、也就是 encounter 內所有 Cells 都成為 Husk 時，才進入 `COLLAPSING`。

`COLLAPSING` 開始後，所有 bodies 停止移動、targeting、damage 與 Gameplay collision，並由 Runtime 統一驅動完整 Husk 輪廓崩解；renderer 不得自行決定 encounter 何時死亡。崩解演出與該Encounter已授權的Runtime-owned Volatile source-event sequence都完成後才轉為`DEFEATED`，由Encounter／root只結算一次XP reward並授權一次Run Modifier reward，再進入cleanup；不能由每個child重複發放或提前清除Husk。

Modifier reward token必須在root／child cleanup前建立，並遵守 [`run-modifiers.md`](run-modifiers.md) 的owned-definition exclusion、三選一／二選一、dedicated RNG、`PAUSED_MODIFIER`與原子commit契約。Modifier reward不取代史萊姆原有XP reward。

所有新舊 bodies 都繼承相同的 `encounterId`、`rootBossId` 與 `splitReferenceCellCount = 50`。Boss UI 的 Current／Max HP 以 encounter 內所有 Glyph 聚合；Husk 對 Current HP 貢獻為零，但其 Max Durability 仍計入 Max HP。

### 10.5 分體守恆

每次分體前後必須同時成立：

```text
glyphCountBefore === glyphCountAfter
sumCurrentDurabilityBefore === sumCurrentDurabilityAfter
sumMaxDurabilityBefore === sumMaxDurabilityAfter
every original glyphId has exactly one owner
```

分體不得 clone、復活、治療、重跑 70 點耐久圖，或為了補出完整的 `SLIME` 字樣建立 Cells。每個 Husk 在 commit 後仍須保持 Current Durability `0`、原 Glyph ID、唯一 owner 與原 Max Durability。

## 11. 效能與驗證

### 載入驗證必須拒絕

- Body Blueprint 不是 5 × 14，或 occupied marker 不等於 50。
- Body Blueprint 含有 `X`、`o`、space 以外的 marker，或 `o` 不等於 2。
- `requiredGlyphs` 含 Printable ASCII 以外的字元，或 Rendering bootstrap 缺少任一必要 Atlas frame。
- 耐久圖 occupied positions 與 Body Blueprint 不一致。
- 耐久圖不是 30 個 `1`、20 個 `2`，或總和不等於 70。
- 任一初始 Cell Max Durability 小於 1。
- 任一 morph layout 缺少、重複或增加既有 `slotId`。
- 分體比例不在 `(0, 1]`，或編譯門檻不是 15。

### Runtime 熱路徑限制

- morph 只更新既有 anchors／frames，不配置 Glyph objects。
- split 只轉移 ownership 與重建必要 layout，不複製 Glyph arrays 或 Durability。
- 連通性按 destruction dirty event 計算，不在每幀輪詢。
- Glyph render views 使用 Atlas 與 pool；Eye 只是 frame 變更，不建立另一套 display-object 類型。
- 壓力驗證沿用 `AGENTS.md` 的 Desktop-first normal／stress Glyph budgets；不得為了 FPS 犧牲分體守恆、局部傷害或 collision accuracy。

## 12. 後續里程碑仍需定案的調校值

以下項目尚未被硬寫成產品規則，應在對應實作階段先完成可視或 headless prototype，再回填本文：

- 生成聚合期間是否可被玩家武器鎖定／傷害，以及 Active 切換當步的精確順序；對玩家的接觸傷害已明確關閉，不在此待定項目內。
- Boss spawn 的每次候選上限、retry cadence，以及第一波同側在世界邊界無合法點時的 seeded fallback side。
- Boss 主動攻擊、`COLLAPSING` 的演出時長／視覺調校，以及XP reward數值調校；Run Modifier reward的identity、時機與transaction已由 [`run-modifiers.md`](run-modifiers.md) 固定，不在此列。
