# Player Survival — Health, Shields, Death, and Run Results

> 狀態：產品與工程契約已確認，三階段均已實作：生存／接觸／死亡流程、run statistics 與 immutable run result，以及 React 結算畫面和回主畫面的 lifecycle transaction。本文件不保存任何可調數值的 default；數值只存在對應的 validated config／content。

本文是玩家生命、護盾、incoming damage、接觸碰撞、死亡、單局統計、結算畫面與回主畫面流程的唯一詳細入口。跨系統產品意圖以 [`spec.md`](../../spec.md) 為準，依賴方向與 lifecycle 架構以 [`AGENTS.md`](../../AGENTS.md) 為準；未來生存 Module 的 ordered Slot transaction 另須遵守 [`weapon-system.md`](weapon-system.md)。

## 1. 本里程碑範圍

本次要完成：

- Runtime-owned Player Survival state 與集中 config；
- Health、Shield Layers、shield recharge 與 global damage invulnerability；
- 玩家和普通怪／Boss 權威 Glyph 輪廓的接觸受傷；
- 玩家死亡、`GAME_OVER`、不可變 run result 與停止 simulation；
- 每局時間、正式擊殺數、Weapon Instance 傷害／裝備時間／平均 DPS 統計；
- React HUD、結算畫面與回到主畫面的完整流程。

本次不實作：

- 怪物投射物與其 presentation；
- 藥水、生命自動回復、最大生命、護盾流派等卡片或掉落物；
- 直接攻擊生命值的實際怪物內容；
- 廣告 SDK、廣告請求或假廣告內容。

## 2. 權威狀態與邊界

Player Survival state 是 `WorldState` 的 plain Runtime data，由 fixed-step systems 獨占寫入。它至少表達：

- current／maximum Health；
- current／maximum Shield Layers；
- 最近一次被接受受擊的 simulation timestamp；
- global damage invulnerability 結束的 simulation timestamp。

玩家 Health 不由 Glyph Cell 構成，也不套用 Enemy／Elite／Boss 的 `HEALTHY → DAMAGED → HUSK` 規則。Pixi display objects、React state 與 UI snapshots 都不是生存狀態的寫入來源。

React 只讀取 UI-sized immutable summaries 並送出明確 command。Renderer 可以呈現玩家受擊或死亡，但不得決定 incoming hit 是否成立、護盾是否破裂、Health 是否歸零或何時進入 `GAME_OVER`。

## 3. Config 是唯一數值來源

玩家生存的 authoring values 集中在 `src/game/runtime/gameConfig.ts` 的 `GAME_CONFIG`，由 loading／host boundary 驗證後以 immutable prepared config 注入 Runtime。實作至少加入以下欄位；本文只定義語意，不保存 default：

| Config field | 語意與驗證 |
| --- | --- |
| `initialPlayerHealth` | 開局 current 與 maximum Health；必須是有限正值 |
| `initialPlayerShieldLayers` | 開局 current 與 maximum Shield Layers；必須是有限非負整數 |
| `shieldRechargeIntervalMs` | 每回復一層護盾所需的連續未受擊 RUNNING simulation time；必須是有限正值 |
| `playerDamageInvulnerabilityMs` | 一次受擊被接受後的 global incoming-damage gate 時長；必須是有限正值 |
| `playerCollisionRadius` | 玩家權威圓形接觸判定半徑；必須是有限正值 |

Creature contact damage 保留在各 validated Creature Definition 的 `contactDamage`，不搬入 Player config，也不在本文、Boss sheet 或 enemy sheet 複製。未來 hostile projectile 的 damage／routing 由 projectile content authoring。戰鬥色彩、alpha 與 hit feedback timing 仍由集中 combat visual theme 管理。

任何後續新增的可調生存數值，都必須先成為有名稱、可驗證的 config／content field；不得寫在 system magic number、React component、renderer 或文件範例中。

## 4. Health 契約

- current Health 必須是有限非負 Gameplay number；maximum Health 必須是有限正值，且 current 不得大於 maximum。
- 開局以 `initialPlayerHealth` 同時建立 current 與 maximum Health。
- 有效 Health damage 以同一個集中精度規則扣除並 clamp 至零；不得因浮點殘值延後死亡。
- 未來治療只能透過明確 Runtime transaction 增加 current Health，且不得超過當下 maximum。
- 未來增加 maximum Health、效果被覆蓋或武器被替換時，current Health 如何變動尚未定案；本里程碑不得偷偷實作任一比例補血或扣血規則。
- current Health 歸零時玩家死亡，無論 current Shield Layers 為何。

## 5. Shield Layers 契約

- current 與 maximum Shield Layers 都是非負整數，且 current 不得大於 maximum。
- 開局以 `initialPlayerShieldLayers` 同時建立 current 與 maximum Shield Layers。
- 一層護盾完整承受一次被接受的 attack event。它不依 damage amount 拆分，也不把同一 event 的剩餘傷害 spill 到 Health。
- 護盾擋下攻擊仍算一次被接受受擊：它啟動 global invulnerability、重設 shield recharge，並可在未來發出 shield-hit／shield-broken domain event。
- current Shield Layers 低於 maximum 時，從最近一次被接受受擊起累積 RUNNING simulation time。每到達一個 `shieldRechargeIntervalMs` 就回復一層並繼續計算下一層，直到 maximum。
- 回復排程必須保留 fixed-step overflow，不能因一步跨過多個 interval 就丟失已到期的層數。
- Shield 已滿時不預存 recharge progress；之後的 accepted hit 必須從新的受擊 timestamp 重新等待。
- 同一步若既達到 recharge threshold 又收到 accepted hit，先解析 incoming damage 並重設 recharge，不會先補出一層來阻擋該次攻擊。
- `READY`、`PAUSED_MENU`、`PAUSED_UPGRADE` 與 `GAME_OVER` 都不推進護盾回復或 global invulnerability；兩者只讀 RUNNING simulation time，不讀 wall-clock time。

## 6. Incoming Player Damage

所有玩家受傷來源都先建立 Runtime-owned incoming-damage candidate，至少包含 stable event/source identity、source kind、finite positive damage amount 與明確 route：

- `SHIELD_FIRST`：若 current Shield Layers 尚有層數，消耗一層並完全阻擋該 event；否則扣 Health。
- `HEALTH_ONLY`：略過 Shield Layers，直接扣 Health。此 route 供未來明確標記的怪物能力使用，本里程碑沒有實際內容。

接受順序如下：

1. 只在 `RUNNING` 且玩家尚未死亡時處理 candidate。
2. 非正 damage、無效 source 或重複 event 不成立，也不得啟動任何計時。
3. 玩家仍在 global invulnerability 期間時忽略 candidate；被忽略事件不消耗護盾、不扣 Health，也不重設 shield recharge。
4. 同一 fixed step 有多個合法 candidate 時，依 prepared source-kind ordinal、stable source ID、stable event ID 的順序排序；第一個被接受的事件立即啟動 global invulnerability，因此其餘事件重新通過相同 gate，而不是繞過 gate 批次扣除。
5. 被接受事件依 route 原子修改 Shield／Health，記錄最近受擊 simulation timestamp，並把 invulnerability deadline 設為 config 定義的時間。
6. 修改後立即檢查 Health；死亡條件不能等到 render frame 或 React effect 才成立。

敵方投射物之後加入時只能新增 source adapter，不能建立另一套玩家扣血、無敵或護盾邏輯。

本里程碑所有 creature contact candidates 使用 `SHIELD_FIRST`。未來若某個接觸、投射物或主動能力要直接攻擊 Health，必須由該攻擊 content 明確 author `HEALTH_ONLY`，不能由物種名稱、Glyph 字元或 renderer presentation 推測。

## 7. 怪物接觸碰撞

- 接觸 broad phase 使用 creature prepared footprint，precise phase 則比較 config 定義的玩家圓形 hitbox，與怪物每個權威 outline Glyph 的 collision geometry。
- Glyph world position 必須包含 creature root、layout anchor、Body Motion 與 Material deformation。Renderer position 不得回寫或代替判定。
- `HEALTHY`、`DAMAGED` 與 `HUSK` 在 owner 仍具 Gameplay collision 時都參與完整輪廓；局部變成 Husk 不會縮小玩家面對的接觸範圍。
- 同一 creature owner 即使同時有多個 Glyph 接觸玩家，每個 fixed step 也只產生一個 contact candidate，damage amount 來自該 prepared Creature Definition 的 `contactDamage`。
- 不同 owners 產生不同 candidates，再交由全域 stable ordering 與 invulnerability gate 決定是否接受。
- 目前只有明確具戰鬥碰撞的 active creature phases 會造成接觸候選。文字聚合生成、`COLLAPSING`、`INACTIVE`、`DEAD`／`DEFEATED` 不造成玩家傷害；Slime `REASSEMBLING` 沿用其已確認的 Gameplay collision 契約。
- 接觸查詢在 fixed step 內必須位於權威 root movement、Body Motion 與 deformation position 更新之後。

## 8. 玩家死亡與 phase 優先序

- Health 歸零只提交一次 player-death transition，建立死亡當下的 immutable run result，並把全域 phase 轉為 `GAME_OVER`。
- 一旦 transition 成立，不再開始下一個 fixed simulation step；同一 RAF callback 尚未執行的 catch-up steps 必須停止，pause boundary 不得留下可在回主畫面後洩漏的 accumulator time。
- 已在死亡當步正式 commit 的傷害與死亡結果保留；尚未完成的 creature collapse 不會在 `GAME_OVER` 自動前進。
- 若死亡與 level-up／upgrade trigger 落在同一 fixed step，死亡優先。不得先開啟或保留 `PAUSED_UPGRADE` overlay，也不得消耗 pending upgrade transaction。
- `GAME_OVER` 停止 gameplay time、Weapon Instance equipped time、無敵、shield recharge、AI、攻擊、碰撞、掉落與 cleanup simulation。Renderer 可以呈現靜態或有限的非權威 transition，但不能推進結果資料。
- 重複 damage、phase publication 或 React remount 不得建立第二份 result、重複計入統計或再次執行死亡 side effects。
- `GAME_OVER` phase 與已存在的 immutable run result 可以作為 transition／side-effect idempotency guard，但不得成為能否決 Health 歸零死亡條件的第二份 combat truth。

## 9. Run Statistics

### Gameplay time 與擊殺

- 本場時間只累積 `RUNNING` fixed-step simulation time。`READY`、選單暫停、升級暫停與 `GAME_OVER` 不計時。
- 普通怪與未來 Elite 只在整體 collapse 完成並正式進入 reward-authorizing death state 時各計一次擊殺。
- Boss 以 Encounter 正式 `DEFEATED` 時計一次，不因 root／child bodies、分體或多份 cleanup 重複增加。
- 玩家死亡當下仍在 `COLLAPSING`、尚未正式死亡／`DEFEATED` 的怪物不列入擊殺數。

### Weapon Instance 傷害歸屬

- 每個 damaging attack 在 emission snapshot 保存 stable `sourceWeaponInstanceId`。Damage System 在 mutation 後回報每個 Glyph 實際減少的 Current Durability，累加到該 Instance。
- Total Damage 是實際套用的 Glyph Durability delta，包含 primary direct targets、topology-frontier direct targets 與 Damage Spread targets。
- Miss、Husk Cell 本身沒有發生的 durability delta、同 event 去重、overkill 被 clamp 的部分、純 knockback、Material displacement、particles 與其他 presentation 不計入 Total Damage；由 Husk impact 導向 living topology-frontier target 的實際 durability delta 仍須計入。
- 統計以 stable Weapon Instance ID 隔離，不以 Weapon Definition ID 合併。同 definition 再次取得仍是新的 Instance，建立獨立且歸零的 counter。
- 武器替換後，舊 Instance 的獨立在途攻擊仍歸舊 Instance；傷害不得搬到 replacement。Runtime 可保留 retired record 直到在途 attribution 安全結束，但死亡結果只 filter 當下 loadout 中的 Instances，因此被替換武器不顯示。

### 裝備時間與平均 DPS

- Weapon Instance equipped gameplay time 從它正式 commit 到 loadout 開始，到被替換或玩家死亡為止，只累積 `RUNNING` fixed-step simulation time。
- 沒有怪物可攻擊、武器在 cooldown、攻擊 miss 或玩家只在走位時，仍屬於裝備中 Gameplay time。選單暫停、升級暫停與結算不計入。
- 結算顯示的指標明確命名為「裝備期間平均 DPS」，計算時先把該 Instance 的 equipped gameplay time 正規化為秒，再以 Total Damage 除之。沒有正的 equipped gameplay time 時，Runtime result 使用 unavailable／`null`，UI 顯示無資料，不執行除以零。
- 為避免把它誤讀成理論武器 DPS，每張武器結果同時顯示 Total Damage 與 equipped gameplay time，並標示只統計目前裝備的該 Weapon Instance。

### 最高傷害裝飾

- 只比較死亡當下仍裝備的 Weapon Instances，依 Total Damage 選出最高者，顯示金色裝飾與小皇冠。
- Total Damage 相同時，較早正式取得／commit 的 Instance 勝出；若 acquisition order 仍相同，以 stable Weapon Instance ID 決定。
- 所有可比較武器都沒有造成傷害時不頒皇冠。

## 10. Run Result、HUD 與結算 UI

Bridge 的 immutable `UiSnapshot` 在遊戲中提供 UI-sized survival summary：current／maximum Health、current／maximum Shield Layers、phase 與既有 HUD values。只在值改變或既有低頻 publication cadence 發布，不能為此每個 render frame 更新 React state。

進入 `GAME_OVER` 時，snapshot 另外提供一份固定的 run result：

- 本場 Gameplay time；
- 正式擊殺數；
- 最終 Player Level；
- 死亡當下仍裝備的 Weapon Instances，維持 loadout order；
- 每把武器的 identity／名稱、stable instance ID、ordered Module Slots、各 Module 名稱與 Rank；
- 每把武器的 Total Damage、equipped gameplay time、裝備期間平均 DPS，以及是否取得最高傷害裝飾。

沒有 Weapon Level 欄位；「modules 和等級」只指各 Slot 的 Module Rank。Run result 不含 Glyph arrays、projectiles、retired weapons、Pixi objects 或 mutable Runtime references。

結算是 React-owned DOM screen，視覺語言、字體、panel、按鈕與動態風格應延續首頁。它可以覆蓋已停止的 Canvas，但不得從 render snapshot 反推統計。畫面結構預留未來廣告版位的 extension point；本里程碑不載入 SDK、不發請求，也不顯示偽造廣告。

## 11. 回到主畫面

結算頁的按鈕送出明確 `returnToMainMenu` command。Runtime／Host 只在合法 phase 接受，並以一個 lifecycle transaction：

- 丟棄本局 WorldState、pending upgrades、run statistics、run result 與輸入狀態；
- 清空本局 Glyph、creature、projectile 與 effect，將 active render views 解除同步並歸還既有 pool，不保留可在下一局觸發的 event；
- 回到 `READY`／主畫面與初始武器選擇流程；
- 保留可安全重用的 GameHost、Pixi Application、prepared content、visual theme 與永久解鎖 snapshot，避免整頁 reload。

下一局建立全新的 Weapon Instance IDs／counters 與生存狀態。舊局的傷害、擊殺、時間、invulnerability deadline 或 shield recharge progress 都不得洩漏。重複 command 必須有定義且不得重複 dispose 資源。

## 12. 未來生命／護盾 Module 卡

以下只是已確認的擴充方向，不是本里程碑 content：治療／自動回復、增加 maximum Health、增加 maximum Shield Layers、縮短護盾回復時間、shield hit／shield broken 觸發效果，以及其他護盾 Build。

這些卡未來仍是 `MODULE` choice，必須指定一個 Weapon Instance，並像通用武器 Module 一樣占用 ordered Slot、同類升 Rank、可被覆蓋，且隨該 Weapon Instance 被替換而摧毀。Player-wide 效果從目前裝備 Slots 聚合，不得改成不占欄位的永久被動，也不得轉移到 replacement weapon。

正式實作前仍需由產品定案：各 Module Definition／Rank table、同類與跨武器疊加、maximum Health／Shield 降低時 current values 的調整、shield broken event timing，以及效果覆蓋／替換與死亡同一步的優先序。在這些規則確認前，不得把卡加入 offer pool、建立 UI preview，或先做 dormant Runtime branch。

## 13. 必要驗證

純規則與高風險 deterministic tests 應覆蓋：

- config validation 拒絕不合法 Health、Shield、duration 與 collision radius；
- 一層護盾完整吸收一次 `SHIELD_FIRST` event，且不 spill 到 Health；
- `HEALTH_ONLY` 明確略過仍存在的護盾；
- 被接受的 shield hit 重設 recharge 並啟動 invulnerability，被 invulnerability 忽略的 hit 不會；
- shield recharge 只讀 RUNNING simulation time、保留 interval overflow 並停止於 maximum；
- 同 owner 多 Glyph 接觸只產生一個 candidate，Husk 仍參與 active outline；
- 多 owner 同步接觸使用 stable ordering，且不能在同一 invulnerability window 批次扣血；
- Health 歸零優先進入 `GAME_OVER`，停止 catch-up steps 並壓過同一步 upgrade；
- kill count 只在正式 death／Boss Encounter defeat 增加，玩家死亡時未完成 collapse 不計；
- actual Glyph Durability delta 正確歸屬 stable Weapon Instance，排除 overkill、Husk Cell 本身未發生的 delta 與純 presentation，同時保留 living topology-frontier target 的實際傷害；
- replacement weapon 從空 counter 開始，舊在途 attack 不轉嫁，結果只列 death-time loadout；
- equipped time 包含 RUNNING 中沒有目標的時間，但排除所有 pause／result time；
- average DPS、tie-break、all-zero no-crown 與 immutable result snapshot；
- `returnToMainMenu` 清除舊 World／result 並讓下一局從乾淨狀態開始。

瀏覽器實機驗收另外確認 HUD 可讀性、接觸受傷手感、首頁與結算頁視覺一致、responsive layout、keyboard／pointer 操作，以及 reduced-motion 路徑。任何實機調整出的數值仍只回填 config／content，不回填本文。
