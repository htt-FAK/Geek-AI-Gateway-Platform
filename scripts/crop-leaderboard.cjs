// 将榜单参考图切块，便于 OCR 分区识别（一次性工具脚本）
const path = require("path");
const sharp = require("sharp");

const src = process.argv[2];
const outDir = process.argv[3];

(async () => {
  const img = sharp(src);
  const { width, height } = await img.metadata();
  console.log("source", width, "x", height);
  // 分区：左上图表密集区 / 右上 / 左下 / 右下 / 底部坐标轴 / 顶部标题
  const regions = {
    "top": { left: 0, top: 0, width, height: Math.round(height * 0.22) },
    "chart-left": { left: 0, top: Math.round(height * 0.15), width: Math.round(width * 0.55), height: Math.round(height * 0.75) },
    "chart-right": { left: Math.round(width * 0.45), top: Math.round(height * 0.15), width: width - Math.round(width * 0.45), height: Math.round(height * 0.75) },
    "bottom": { left: 0, top: Math.round(height * 0.78), width, height: height - Math.round(height * 0.78) },
    "yaxis": { left: 0, top: Math.round(height * 0.15), width: Math.round(width * 0.12), height: Math.round(height * 0.75) },
  };
  for (const [name, r] of Object.entries(regions)) {
    const out = path.join(outDir, `crop-${name}.png`);
    await sharp(src).extract(r).png().toFile(out);
    console.log("wrote", out, JSON.stringify(r));
  }
})();