export const SUPPORTED_LANGUAGES = Object.freeze([
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" }
]);

export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_STORAGE_KEY = "anime-hair-studio-language";

const JA = Object.freeze({
  "Shortcuts": "\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8",
  "Preferences...": "\u8a2d\u5b9a...",
  "Preferences": "\u8a2d\u5b9a",
  "Configure application behavior and optional features.": "\u30a2\u30d7\u30ea\u306e\u52d5\u4f5c\u3068\u30aa\u30d7\u30b7\u30e7\u30f3\u6a5f\u80fd\u3092\u8a2d\u5b9a\u3057\u307e\u3059\u3002",
  "Close preferences": "\u8a2d\u5b9a\u3092\u9589\u3058\u308b",
  "Preference categories": "\u8a2d\u5b9a\u30ab\u30c6\u30b4\u30ea",
    "Navigation tips": "\u30ca\u30d3\u30b2\u30fc\u30b7\u30e7\u30f3\u30d2\u30f3\u30c8",
    "Show viewport navigation controls in the bottom-left corner.": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u306e\u5de6\u4e0b\u306b\u30ca\u30d3\u30b2\u30fc\u30b7\u30e7\u30f3\u64cd\u4f5c\u3092\u8868\u793a\u3057\u307e\u3059\u3002",
    "Tool tips": "\u30c4\u30fc\u30eb\u30d2\u30f3\u30c8",
    "Show contextual modeling guidance in the viewport.": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u306b\u30b3\u30f3\u30c6\u30ad\u30b9\u30c8\u306b\u5fdc\u3058\u305f\u30e2\u30c7\u30ea\u30f3\u30b0\u30ac\u30a4\u30c9\u3092\u8868\u793a\u3057\u307e\u3059\u3002",
    "Show selected and total vertex, triangle, and FPS statistics.": "\u9078\u629e\u4e2d\u3068\u5168\u4f53\u306e\u9802\u70b9\u6570\u3001\u4e09\u89d2\u5f62\u6570\u3001FPS\u3092\u8868\u793a\u3057\u307e\u3059\u3002",
  "Viewport navigation tips": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u30ca\u30d3\u30b2\u30fc\u30b7\u30e7\u30f3\u306e\u30d2\u30f3\u30c8",
  "Alt + Left Mouse": "Alt + \u5de6\u30de\u30a6\u30b9",
  "Alt + Right Mouse": "Alt + \u53f3\u30de\u30a6\u30b9",
  "Scrollwheel": "\u30de\u30a6\u30b9\u30db\u30a4\u30fc\u30eb",
  "Orbit": "\u30aa\u30fc\u30d3\u30c3\u30c8",
  "Pan": "\u30d1\u30f3",
  "Zoom": "\u30ba\u30fc\u30e0",
  "Center viewport on selected object": "\u9078\u629e\u3057\u305f\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u3092\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u306e\u4e2d\u592e\u306b\u8868\u793a",
  "Center viewport on selected strand or guide": "\u9078\u629e\u3057\u305f\u30b9\u30c8\u30e9\u30f3\u30c9\u307e\u305f\u306f\u30ac\u30a4\u30c9\u3092\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u306e\u4e2d\u592e\u306b\u8868\u793a",
  "Experimental Features": "\u5b9f\u9a13\u7684\u6a5f\u80fd",
  "Radial menus": "\u30e9\u30b8\u30a2\u30eb\u30e1\u30cb\u30e5\u30fc",
  "Enable the contextual Spacebar menu and tool shortcut hold menus.": "\u30b9\u30da\u30fc\u30b9\u30d0\u30fc\u306e\u30b3\u30f3\u30c6\u30ad\u30b9\u30c8\u30e1\u30cb\u30e5\u30fc\u3068\u30c4\u30fc\u30eb\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8\u306e\u9577\u62bc\u3057\u30e1\u30cb\u30e5\u30fc\u3092\u6709\u52b9\u306b\u3057\u307e\u3059\u3002",
  "Done": "\u5b8c\u4e86",
  "Keyboard Shortcuts": "\u30ad\u30fc\u30dc\u30fc\u30c9\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8",
  "Quick access to tools, editing modes, and viewport navigation.": "\u30c4\u30fc\u30eb\u3001\u7de8\u96c6\u30e2\u30fc\u30c9\u3001\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u64cd\u4f5c\u306b\u3059\u3070\u3084\u304f\u30a2\u30af\u30bb\u30b9\u3067\u304d\u307e\u3059\u3002",
  "Close shortcuts": "\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8\u3092\u9589\u3058\u308b",
  "Tools": "\u30c4\u30fc\u30eb",
  "Editing": "\u7de8\u96c6",
  "General and Viewport": "\u5168\u822c\u3068\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8",
  "Rotate tool": "\u56de\u8ee2\u30c4\u30fc\u30eb",
  "Relax tool": "\u30ea\u30e9\u30c3\u30af\u30b9\u30c4\u30fc\u30eb",
  "Draw strand": "\u30b9\u30c8\u30e9\u30f3\u30c9\u3092\u63cf\u753b",
  "Split Panel": "\u30b9\u30d7\u30ea\u30c3\u30c8\u30d1\u30cd\u30eb",
  "Draw braid": "\u4e09\u3064\u7de8\u307f\u3092\u63cf\u753b",
  "Toggle proportional editing": "\u30d7\u30ed\u30dd\u30fc\u30b7\u30e7\u30ca\u30eb\u7de8\u96c6\u3092\u5207\u308a\u66ff\u3048",
  "Move the mouse to resize proportional influence": "\u30de\u30a6\u30b9\u3092\u52d5\u304b\u3057\u3066\u5f71\u97ff\u7bc4\u56f2\u3092\u5909\u66f4",
  "Toggle World and Object transform space": "\u30ef\u30fc\u30eb\u30c9\u3068\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u5909\u63db\u7a7a\u9593\u3092\u5207\u308a\u66ff\u3048",
  "Toggle hierarchy editing": "\u968e\u5c64\u7de8\u96c6\u3092\u5207\u308a\u66ff\u3048",
  "Previous curve point in the hierarchy": "\u968e\u5c64\u5185\u306e\u524d\u306e\u30ab\u30fc\u30d6\u30dd\u30a4\u30f3\u30c8",
  "Next curve point in the hierarchy": "\u968e\u5c64\u5185\u306e\u6b21\u306e\u30ab\u30fc\u30d6\u30dd\u30a4\u30f3\u30c8",
  "Orbit drag": "\u30aa\u30fc\u30d3\u30c3\u30c8\u30c9\u30e9\u30c3\u30b0",
  "Drag": "\u30c9\u30e9\u30c3\u30b0",
  "Snap the camera to cardinal views": "\u30ab\u30e1\u30e9\u3092\u6b63\u9762\u30fb\u5074\u9762\u306a\u3069\u306b\u30b9\u30ca\u30c3\u30d7",
  "Orbit the camera": "\u30ab\u30e1\u30e9\u3092\u30aa\u30fc\u30d3\u30c3\u30c8",
  "Left drag": "\u5de6\u30c9\u30e9\u30c3\u30b0",
  "Adjust the active brush size": "\u30a2\u30af\u30c6\u30a3\u30d6\u306a\u30d6\u30e9\u30b7\u30b5\u30a4\u30ba\u3092\u8abf\u6574",
  "Hold Spacebar": "\u30b9\u30da\u30fc\u30b9\u30d0\u30fc\u3092\u9577\u62bc\u3057",
  "Choose from the contextual radial menu": "\u30b3\u30f3\u30c6\u30ad\u30b9\u30c8\u30e9\u30b8\u30a2\u30eb\u30e1\u30cb\u30e5\u30fc\u304b\u3089\u9078\u629e",
  "Hold Q / W / E / R": "Q / W / E / R\u3092\u9577\u62bc\u3057",
  "Choose options for that tool": "\u305d\u306e\u30c4\u30fc\u30eb\u306e\u30aa\u30d7\u30b7\u30e7\u30f3\u3092\u9078\u629e",
  "Tool options": "\u30c4\u30fc\u30eb\u30aa\u30d7\u30b7\u30e7\u30f3",
  "Tool": "\u30c4\u30fc\u30eb",
  "Select": "\u9078\u629e",
  "Move": "\u79fb\u52d5",
  "Rotate": "\u56de\u8ee2",
  "Scale": "\u30b9\u30b1\u30fc\u30eb",
  "Strand Select": "\u30b9\u30c8\u30e9\u30f3\u30c9\u9078\u629e",
  "Guide Select": "\u30ac\u30a4\u30c9\u9078\u629e",
  "Reference Select": "\u53c2\u8003\u753b\u50cf\u9078\u629e",
  "World Space": "\u30ef\u30fc\u30eb\u30c9\u7a7a\u9593",
  "Object Space": "\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u7a7a\u9593",
  "2D Translation": "2D\u79fb\u52d5",
  "Disable 2D Translation": "2D\u79fb\u52d5\u3092\u7121\u52b9\u5316",
  "Disable Pull Strand": "\u30b9\u30c8\u30e9\u30f3\u30c9\u5f15\u304d\u3092\u7121\u52b9\u5316",
  "Strand actions": "\u30b9\u30c8\u30e9\u30f3\u30c9\u64cd\u4f5c",
  "Strand": "\u30b9\u30c8\u30e9\u30f3\u30c9",
  "Edit Mode": "\u7de8\u96c6\u30e2\u30fc\u30c9",
  "Strand Editor": "\u30b9\u30c8\u30e9\u30f3\u30c9\u30a8\u30c7\u30a3\u30bf\u30fc",
  "Guide Editor": "\u30ac\u30a4\u30c9\u30a8\u30c7\u30a3\u30bf\u30fc",
  "Reference Editor": "\u53c2\u8003\u753b\u50cf\u30a8\u30c7\u30a3\u30bf\u30fc",
  "Reference": "\u53c2\u8003\u753b\u50cf",
  "Create 2D Viewport Reference": "2D\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u53c2\u8003\u753b\u50cf\u3092\u4f5c\u6210",
  "Create 3D Plane Reference": "3D\u5e73\u9762\u53c2\u8003\u753b\u50cf\u3092\u4f5c\u6210",
  "Mirror strand": "\u30b9\u30c8\u30e9\u30f3\u30c9\u3092\u30df\u30e9\u30fc",
  "Duplicate strand": "\u30b9\u30c8\u30e9\u30f3\u30c9\u3092\u8907\u88fd",
  "Delete strand": "\u30b9\u30c8\u30e9\u30f3\u30c9\u3092\u524a\u9664",
  "Duplicate strand: move the pointer to position its root, then left-click to place. Press Esc to cancel.": "\u30b9\u30c8\u30e9\u30f3\u30c9\u306e\u8907\u88fd\uff1a\u30dd\u30a4\u30f3\u30bf\u30fc\u3067\u30eb\u30fc\u30c8\u4f4d\u7f6e\u3092\u6c7a\u3081\u3001\u5de6\u30af\u30ea\u30c3\u30af\u3067\u914d\u7f6e\u3057\u307e\u3059\u3002Esc\u3067\u30ad\u30e3\u30f3\u30bb\u30eb\u3057\u307e\u3059\u3002",
  "Close the active menu or window": "\u958b\u3044\u3066\u3044\u308b\u30e1\u30cb\u30e5\u30fc\u307e\u305f\u306f\u30a6\u30a3\u30f3\u30c9\u30a6\u3092\u9589\u3058\u308b",
  "Reference Images...": "\u53c2\u8003\u753b\u50cf...",
  "Reference Images": "\u53c2\u8003\u753b\u50cf",
  "References": "\u53c2\u8003",
  "Outliner": "\u30a2\u30a6\u30c8\u30e9\u30a4\u30ca\u30fc",
  "Scene outliner": "\u30b7\u30fc\u30f3\u30a2\u30a6\u30c8\u30e9\u30a4\u30ca\u30fc",
  "Outliner content": "\u30a2\u30a6\u30c8\u30e9\u30a4\u30ca\u30fc\u306e\u5185\u5bb9",
  "Strands": "\u30b9\u30c8\u30e9\u30f3\u30c9",
  "Viewport Overlays": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4",
  "Viewport": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8",
  "Ortho Only": "\u6b63\u6295\u5f71\u306e\u307f",
  "All Views": "\u3059\u3079\u3066\u306e\u30d3\u30e5\u30fc",
  "No references": "\u53c2\u8003\u306a\u3057",
  "No guides": "\u30ac\u30a4\u30c9\u306a\u3057",
  "Surface": "\u30b5\u30fc\u30d5\u30a7\u30b9",
  "Curve": "\u30ab\u30fc\u30d6",
  "Viewport overlays and placeable 3D guides": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4\u3068\u914d\u7f6e\u53ef\u80fd\u306a3D\u30ac\u30a4\u30c9",
  "Add Viewport Overlay": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4\u3092\u8ffd\u52a0",
  "Add 3D Plane": "3D\u5e73\u9762\u3092\u8ffd\u52a0",
  "No reference images added.": "\u53c2\u8003\u753b\u50cf\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093\u3002",
  "Drop image as reference": "\u753b\u50cf\u3092\u53c2\u8003\u753b\u50cf\u3068\u3057\u3066\u30c9\u30ed\u30c3\u30d7",
  "Drop anywhere in the viewport for a 2D overlay, or choose a 3D plane view.": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u5185\u306e\u4efb\u610f\u306e\u5834\u6240\u306b\u30c9\u30ed\u30c3\u30d7\u3059\u308b\u30682D\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4\u306b\u306a\u308a\u307e\u3059\u30023D\u5e73\u9762\u306e\u30d3\u30e5\u30fc\u3082\u9078\u629e\u3067\u304d\u307e\u3059\u3002",
  "2D Overlay": "2D\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4",
  "Type": "\u30bf\u30a4\u30d7",
  "Viewport Overlay": "\u30d3\u30e5\u30fc\u30dd\u30fc\u30c8\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4",
  "3D Plane": "3D\u5e73\u9762",
  "In front of mesh": "\u30e1\u30c3\u30b7\u30e5\u306e\u524d\u9762",
  "Visible": "\u8868\u793a",
  "Opacity": "\u4e0d\u900f\u660e\u5ea6",
  "View": "\u30d3\u30e5\u30fc",
  "Only in Front Orthogonal view": "\u524d\u9762\u306e\u6b63\u6295\u5f71\u30d3\u30e5\u30fc\u3067\u306e\u307f\u8868\u793a",
  "Only in Back Orthogonal view": "\u80cc\u9762\u306e\u6b63\u6295\u5f71\u30d3\u30e5\u30fc\u3067\u306e\u307f\u8868\u793a",
  "Only in Left Orthogonal view": "\u5de6\u5074\u9762\u306e\u6b63\u6295\u5f71\u30d3\u30e5\u30fc\u3067\u306e\u307f\u8868\u793a",
  "Only in Right Orthogonal view": "\u53f3\u5074\u9762\u306e\u6b63\u6295\u5f71\u30d3\u30e5\u30fc\u3067\u306e\u307f\u8868\u793a",
  "Show this plane only in orthographic mode when the camera is snapped to its assigned view.": "\u30ab\u30e1\u30e9\u304c\u6307\u5b9a\u30d3\u30e5\u30fc\u306b\u30b9\u30ca\u30c3\u30d7\u3055\u308c\u305f\u6b63\u6295\u5f71\u30e2\u30fc\u30c9\u3067\u306e\u307f\u3053\u306e\u5e73\u9762\u3092\u8868\u793a\u3057\u307e\u3059\u3002",
  "Front": "\u524d",
  "Back": "\u5f8c\u308d",
  "Left": "\u5de6",
  "Right": "\u53f3",
  "Horizontal": "\u6c34\u5e73",
  "Vertical": "\u5782\u76f4",
  "Scale": "\u30b9\u30b1\u30fc\u30eb",
  "Use Move (W) and Scale (R) to fit the plane to your mesh.": "\u79fb\u52d5 (W) \u3068\u30b9\u30b1\u30fc\u30eb (R) \u3067\u5e73\u9762\u3092\u30e1\u30c3\u30b7\u30e5\u306b\u5408\u308f\u305b\u307e\u3059\u3002",
  "Delete Reference": "\u53c2\u8003\u753b\u50cf\u3092\u524a\u9664",
  "Toggle orthographic view": "\u6b63\u6295\u5f71\u8868\u793a\u3092\u5207\u308a\u66ff\u3048",
  "Switch to orthographic view": "\u6b63\u6295\u5f71\u8868\u793a\u306b\u5207\u308a\u66ff\u3048",
  "Switch to perspective view": "\u900f\u8996\u6295\u5f71\u8868\u793a\u306b\u5207\u308a\u66ff\u3048",
  "Hair Card": "\u30d8\u30a2\u30ab\u30fc\u30c9",
  "Generates the strand as an open, double-sided ribbon instead of a closed volume.": "\u30b9\u30c8\u30e9\u30f3\u30c9\u3092\u9589\u3058\u305f\u7acb\u4f53\u5f62\u72b6\u3067\u306f\u306a\u304f\u3001\u958b\u3044\u305f\u4e21\u9762\u30ea\u30dc\u30f3\u3068\u3057\u3066\u751f\u6210\u3057\u307e\u3059\u3002",
  "File": "ファイル",
  "Open": "開く",
  "Save": "保存",
  "Local Save": "ローカル保存",
  "Export to OBJ": "OBJに書き出し",
  "Export to Python For Maya": "Maya用Pythonに書き出し",
  "Local Export to OBJ": "OBJにローカル書き出し",
  "Local Export to Python For Maya": "Maya用Pythonにローカル書き出し",
  "Import Head Mesh": "頭部メッシュを読み込む",
  "Edit": "編集",
  "Undo": "元に戻す",
  "Redo": "やり直す",
  "Delete": "削除",
  "Guides": "ガイド",
  "Edit Scalp": "頭皮を編集",
  "Scalp Painting": "頭皮ペイント",
  "Edit Head": "頭部を編集",
  "Capsule Guide": "カプセルガイド",
  "Materials": "マテリアル",
  "No material commands yet": "マテリアルコマンドはまだありません",
  "Settings": "設定",
  "Language": "言語",
  "Version": "バージョン",
  "English": "英語",
  "Help": "ヘルプ",
  "Join The Discord": "Discordに参加",
  "Anime Hair Studio": "Anime Hair Studio",
  "Strand Outliner": "ストランドアウトライナー",
  "Strand outliner": "ストランドアウトライナー",
  "Front Bangs": "前髪",
  "No strands": "ストランドなし",
  "Navigate curve points": "カーブポイントを移動",
  "No point selected: root / tip": "ポイント未選択：根元 / 毛先",
  "Exit Editor": "エディターを終了",
  "Selected": "選択中",
  "Total": "合計",
  "Performance": "パフォーマンス",
  "Main": "メイン",
  "Display": "表示",
  "Scalp Guide": "頭皮ガイド",
  "Create Capsule Guide From Scalp": "頭皮からカプセルガイドを作成",
  "Scalp guide actions": "頭皮ガイドの操作",
  "Scalp Curve Guide": "頭皮カーブガイド",
  "Curve Lattice": "カーブ格子",
  "Transparent Head": "頭部を透明化",
  "Rough Scalp Fit": "頭皮の概形調整",
  "Scale X": "Xスケール",
  "Scale Y": "Yスケール",
  "Scale Z": "Zスケール",
  "Confirm Plane": "平面を確定",
  "Generate Surface Preview": "サーフェスプレビューを生成",
  "Guide Mesh": "ガイドメッシュ",
  "Default": "デフォルト",
  "Import Custom Mesh...": "カスタムメッシュを読み込む...",
  "Mirror X": "Xミラー",
  "Side Flatten": "側面の平坦化",
  "Top Height": "上部の高さ",
  "Bottom Height": "下部の高さ",
  "Hairline Rows": "生え際の行数",
  "Side Bang Rows": "横前髪の行数",
  "Root Scalp Offset": "根元の頭皮オフセット",
  "Top Width": "上部の幅",
  "Top Depth": "上部の奥行き",
  "Middle Width": "中央の幅",
  "Middle Depth": "中央の奥行き",
  "Bottom Width": "下部の幅",
  "Bottom Depth": "下部の奥行き",
  "Advanced lattice": "高度な格子",
  "Surface Fit": "サーフェス調整",
  "Center X": "中心 X",
  "Center Y": "中心 Y",
  "Center Z": "中心 Z",
  "Radius": "半径",
  "Width": "幅",
  "Height": "高さ",
  "Depth": "奥行き",
  "Scalp Regions": "頭皮リージョン",
  "Bangs Root": "前髪の根元",
  "Side Bangs L": "横前髪 左",
  "Side Bangs R": "横前髪 右",
  "Side Bangs Left": "横前髪 左",
  "Side Bangs Right": "横前髪 右",
  "Side L": "側面 左",
  "Side R": "側面 右",
  "Side Left": "側面 左",
  "Side Right": "側面 右",
  "Back": "後頭部",
  "Unassigned": "未割り当て",
  "Group Settings": "グループ設定",
  "Length": "長さ",
  "Layer Spacing": "レイヤー間隔",
  "Bottom": "下層",
  "Mid": "中層",
  "Top": "上層",
  "Accent": "アクセント",
  "Shape": "形状",
  "Taper Curve": "テーパーカーブ",
  "Depth Curve": "奥行きカーブ",
  "Topology": "トポロジー",
  "Along Curve": "カーブ方向",
  "Dynamic Density": "動的密度",
  "Aggressiveness": "最適化の強さ",
  "Around Loops": "断面ループ",
  "Strand Profile": "ストランド断面",
  "Selected strand": "選択中のストランド",
  "Material": "マテリアル",
  "Create material": "マテリアルを作成",
  "Clump Guide": "束ガイド",
  "Influence": "影響度",
  "Clump Shape": "束の形状",
  "Spread": "広がり",
  "Depth Spread": "奥行きの広がり",
  "Tip Fan": "毛先の広がり",
  "Roll": "ロール",
  "Strand Width": "ストランド幅",
  "Strand Depth": "ストランド奥行き",
  "Variation": "ばらつき",
  "Project Materials": "プロジェクトマテリアル",
  "Material Properties": "マテリアル属性",
  "Name": "名前",
  "Color": "カラー",
  "Thickness": "太さ",
  "Position": "位置",
  "Rotation": "回転",
  "Layer": "レイヤー",
  "Split Tip": "毛先を分割",
  "Split Spacing": "分割間隔",
  "Length Loops": "長さ方向ループ",
  "Pull Strand": "ストランドを引く",
  "Rigidity": "硬さ",
  "Head Collision": "頭部との衝突",
  "Contextual 2D Free Translation": "コンテキスト2D自由移動",
  "Snapped Views Only": "スナップビューのみ",
  "Place Strand Tool": "ストランド配置ツール",
  "Auto-show Scalp Guide": "頭皮ガイドを自動表示",
  "Draw Strand Tool": "ストランド描画ツール",
  "Draw settings": "描画設定",
  "Choose how the stroke is projected into 3D space.": "ストロークを3D空間へ投影する方法を選択します。",
  "Choose the layer assigned to newly drawn strands.": "新しく描画するストランドのレイヤーを選択します。",
  "Brush Preset": "ブラシプリセット",
  "Strand Preset": "ストランドプリセット",
  "Brush Size": "ブラシサイズ",
  "Smoothing": "スムージング",
  "Curve Step": "カーブ間隔",
  "Surface Normal Influence": "サーフェス法線の影響",
  "Live Surface": "ライブサーフェス",
  "Continue from Tip": "毛先から続ける",
  "Braid Tool": "三つ編みツール",
  "Braid Preset": "三つ編みプリセット",
  "Braid Size": "三つ編みサイズ",
  "Braid Mesh": "三つ編みメッシュ",
  "Classic Braid": "標準の三つ編み",
  "Coil": "コイル",
  "Split Panel Tool": "スプリットパネルツール",
  "Panel Geometry": "パネル形状",
  "Crosswise Loops": "横方向ループ",
  "Lengthwise Loops": "縦方向ループ",
  "Horizontal Curvature": "水平カーブ",
  "Cut Roundness": "切り口の丸み",
  "Split Geometry": "形状を分割",
  "Snap Zippers to Loops": "分割線をループにスナップ",
  "Left Edge Trim": "左端をトリム",
  "Right Edge Trim": "右端をトリム",
  "Transform Space": "変換空間",
  "World": "ワールド",
  "Object": "オブジェクト",
  "Move Tool": "移動ツール",
  "Hierarchy Edit": "階層編集",
  "Recursive Transform": "再帰変換",
  "Proportional Edit": "プロポーショナル編集",
  "Falloff": "フォールオフ",
  "Smooth": "スムーズ",
  "Linear": "リニア",
  "Constant": "一定",
  "Light Angle": "ライト角度",
  "Strands by Region": "リージョン別ストランド",
  "All Regions": "全リージョン",
  "Strands by Layer": "レイヤー別ストランド",
  "All Layers": "全レイヤー",
  "Capsule Guides": "カプセルガイド",
  "All Guides": "全ガイド",
  "Center Visibility": "中心の表示",
  "Scalp": "頭皮",
  "Fresnel Transparency": "フレネル透明度",
  "Preset Library": "プリセットライブラリ",
  "Full Hair Presets": "フルヘアプリセット",
  "Full Hair": "フルヘア",
  "Elements": "パーツ",
  "Custom": "カスタム",
  "Create Strand Preset": "ストランドプリセットを作成",
  "Preset Name": "プリセット名",
  "Cancel": "キャンセル",
  "Create": "作成",
  "Add point": "ポイントを追加",
  "Delete point": "ポイントを削除",
  "Reset curve": "カーブをリセット",
  "Reset profile": "断面をリセット",
  "Continue": "続行",
  "Keep Snapping": "スナップを維持",
  "Disable": "無効化",
  "Do not show this again": "今後表示しない",
  "Create mirror instance": "ミラーインスタンスを作成",
  "Dissolve clump": "束を解除",
  "Delete clump": "束を削除",
  "Select tool": "選択ツール",
  "Move tool": "移動ツール",
  "Rotate curve point tool": "カーブポイント回転ツール",
  "Scale tool": "スケールツール",
  "Relax curve point tool": "カーブポイント緩和ツール",
  "Draw strand tool": "ストランド描画ツール",
  "Split Panel tool": "スプリットパネルツール",
  "Split Panel (P)": "スプリットパネル (P)",
  "Split Panel: draw its center path on the contextual 2D plane.": "スプリットパネル：コンテキスト2D平面上に中心パスを描画します。",
  "Split Panel: drag across the selected surface. The center path remains conformed to it.": "スプリットパネル：選択したサーフェス上をドラッグします。中心パスはサーフェスに沿ったままになります。",
  "Split Panel: drag across the live surface. Beyond its boundary, continue on the contextual plane.": "スプリットパネル：ライブサーフェス上をドラッグし、境界の外ではコンテキスト平面上を続けます。",
  "Split Panel: drag a center path from the chosen live surface.": "スプリットパネル：選択したライブサーフェスから中心パスをドラッグします。",
  "Braid tool": "三つ編みツール",
  "Application menu": "アプリケーションメニュー",
  "3D hair editor": "3Dヘアエディター",
  "Viewport statistics": "ビューポート統計",
  "Modeling tools": "モデリングツール",
  "Editing modes": "編集モード",
  "Viewport display controls": "ビューポート表示コントロール",
  "Hair controls": "ヘアコントロール",
  "Attribute editor": "属性エディター",
  "Reset camera": "カメラをリセット",
  "Show scalp guide": "頭皮ガイドを表示",
  "Show group colors": "グループカラーを表示",
  "Close": "閉じる",
  "Save the current working creation shape.": "現在の作成形状を保存します。",
  "Select a control point and use the gizmo to shape the region-colored scalp curves.": "コントロールポイントを選択し、ギズモでリージョン色の頭皮カーブを調整します。"
});

export function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.some((language) => language.id === value) ? value : DEFAULT_LANGUAGE;
}

export function translateUiString(value, language = DEFAULT_LANGUAGE) {
  if (language !== "ja" || typeof value !== "string") return value;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const text = value.trim();
  if (!text) return value;
  if (JA[text]) return `${leading}${JA[text]}${trailing}`;

  const strandCount = text.match(/^(\d+) strands?$/);
  if (strandCount) return `${leading}${strandCount[1]} ストランド${trailing}`;
  const vertexStats = text.match(/^(.+) verts \/ (.+) tris$/);
  if (vertexStats) return `${leading}${vertexStats[1]} 頂点 / ${vertexStats[2]} 三角形${trailing}`;
  const collapseLabel = text.match(/^Collapse (.+)$/);
  if (collapseLabel) {
    const translatedLabel = translateUiString(collapseLabel[1], language);
    if (translatedLabel !== collapseLabel[1]) return `${leading}${translatedLabel}を折りたたむ${trailing}`;
  }
  return value;
}

export function createDocumentLocalizer(root, initialLanguage = DEFAULT_LANGUAGE) {
  let language = normalizeLanguage(initialLanguage);
  let changingLanguage = false;
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const localizedAttributes = ["title", "aria-label", "placeholder"];

  function localizeTextNode(node) {
    const current = node.nodeValue;
    let source = textSources.get(node);
    if (source === undefined) {
      source = current;
      textSources.set(node, source);
    } else if (!changingLanguage) {
      const expected = translateUiString(source, language);
      if (current !== source && current !== expected) {
        source = current;
        textSources.set(node, source);
      }
    }
    const translated = translateUiString(source, language);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  function localizeElement(element) {
    if (element.matches?.("script, style")) return;
    let sources = attributeSources.get(element);
    if (!sources) {
      sources = {};
      attributeSources.set(element, sources);
    }
    localizedAttributes.forEach((attribute) => {
      if (!element.hasAttribute?.(attribute)) return;
      const current = element.getAttribute(attribute);
      const previous = sources[attribute];
      if (previous === undefined || (!changingLanguage && current !== previous && current !== translateUiString(previous, language))) {
        sources[attribute] = current;
      }
      const translated = translateUiString(sources[attribute], language);
      if (current !== translated) element.setAttribute(attribute, translated);
    });
  }

  function localizeSubtree(node) {
    if (node.nodeType === 3) {
      localizeTextNode(node);
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) localizeElement(node);
    const walker = root.createTreeWalker(node, 0x5);
    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === 3) localizeTextNode(current);
      else localizeElement(current);
      current = walker.nextNode();
    }
  }

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "attributes") localizeElement(record.target);
      else if (record.type === "characterData") localizeTextNode(record.target);
      else record.addedNodes.forEach(localizeSubtree);
    });
  });

  function setLanguage(nextLanguage) {
    language = normalizeLanguage(nextLanguage);
    root.documentElement.lang = language;
    changingLanguage = true;
    try {
      localizeSubtree(root.documentElement);
    } finally {
      changingLanguage = false;
    }
    return language;
  }

  setLanguage(language);
  observer.observe(root.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: localizedAttributes
  });

  return {
    get language() {
      return language;
    },
    setLanguage,
    disconnect: () => observer.disconnect()
  };
}
