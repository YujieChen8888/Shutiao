export const OUTFITS = [
  {
    id: "none",
    name: "原生毛色",
    note: "暖米色与深咖啡重点色",
    color: "#c9b899",
    trim: "#392d28",
  },
  {
    id: "blue-collar",
    name: "晴空项圈",
    note: "照片里的蓝色织带与银色搭扣",
    color: "#719fbc",
    trim: "#d9e1e6",
  },
  {
    id: "mint-vest",
    name: "薄荷奶糖",
    note: "还原薄荷绿背心、粉色包边",
    color: "#91d2bc",
    trim: "#edb0bc",
  },
  {
    id: "oat-knit",
    name: "燕麦针织",
    note: "还原米色罗纹毛衣",
    color: "#c9bb96",
    trim: "#e3d8b8",
  },
  {
    id: "vampire",
    name: "小小伯爵",
    note: "还原黑红披风、立领与红丝带",
    color: "#28252c",
    trim: "#cd3545",
  },
  {
    id: "sailor",
    name: "海盐水手",
    note: "海军蓝制服、白边与小领结",
    color: "#294d72",
    trim: "#f0eee5",
  },
  {
    id: "raincoat",
    name: "柠檬雨衣",
    note: "明黄色雨披与珍珠扣",
    color: "#e9bd49",
    trim: "#f9e9ac",
  },
  {
    id: "festive",
    name: "新年围巾",
    note: "红色围巾、金色流苏",
    color: "#bd3a42",
    trim: "#e9c974",
  },
] as const;
export type OutfitId = (typeof OUTFITS)[number]["id"];
export function outfitFor(id?: string) {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[1];
}

/** The same wardrobe in the classic renderer, positioned on its animated spine. */
export function drawOutfit2D(
  ctx: CanvasRenderingContext2D,
  id: string,
  neck: { x: number; y: number },
  hip: { x: number; y: number },
  width: number,
  behind = false,
) {
  const o = outfitFor(id);
  if (o.id === "none") return;
  const x = neck.x,
    y = neck.y,
    h = Math.max(30, hip.y - y),
    w = width;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 2;
  if (behind) {
    if (o.id === "vampire") {
      ctx.fillStyle = o.trim;
      ctx.strokeStyle = "#33212b";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.65, y + 9);
      ctx.lineTo(x - w * 1.2, y - 39);
      ctx.lineTo(x - w * 0.86, y - 57);
      ctx.lineTo(x, y - 23);
      ctx.lineTo(x + w * 0.86, y - 57);
      ctx.lineTo(x + w * 1.2, y - 39);
      ctx.lineTo(x + w * 0.65, y + 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.fillStyle = o.color;
  ctx.strokeStyle = o.trim;
  if (o.id === "blue-collar" || o.id === "festive") {
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.81, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (o.id === "festive") {
      ctx.fillRect(x + 9, y, 17, 48);
      ctx.strokeRect(x + 9, y, 17, 48);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 10 + i * 4, y + 48);
        ctx.lineTo(x + 10 + i * 4, y + 56);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = o.trim;
      ctx.fillRect(x - 10, y - 4, 20, 12);
      ctx.fillStyle = o.color;
      ctx.fillRect(x - 6, y - 1, 12, 6);
      ctx.fillStyle = "#e8d5aa";
      ctx.beginPath();
      ctx.arc(x, y + 19, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.66, y);
    ctx.quadraticCurveTo(x, y + 19, x + w * 0.66, y);
    ctx.lineTo(hip.x + w * 0.95, hip.y - 6);
    ctx.quadraticCurveTo(hip.x, hip.y + 9, hip.x - w * 0.95, hip.y - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (o.id === "oat-knit") {
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.4;
      for (let i = -w; i <= w; i += 5) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(hip.x + i, hip.y + 10);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.66, y);
    ctx.quadraticCurveTo(x, y + 19, x + w * 0.66, y);
    ctx.stroke();
    if (o.id === "vampire") {
      ctx.fillStyle = "#c9b899";
      ctx.beginPath();
      ctx.moveTo(x, y + 12);
      ctx.lineTo(hip.x + 25, hip.y);
      ctx.lineTo(hip.x - 25, hip.y);
      ctx.closePath();
      ctx.fill();
    }
    if (o.id === "vampire" || o.id === "sailor") {
      ctx.fillStyle = o.id === "vampire" ? o.trim : "#cd5962";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, y + 17);
        ctx.lineTo(x + s * 22, y + 8);
        ctx.lineTo(x + s * 19, y + 28);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillRect(x - 3, y + 17, 6, 30);
    } else if (o.id === "raincoat") {
      ctx.fillStyle = o.trim;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x, y + 25 + i * 18, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (o.id === "mint-vest") {
      ctx.fillStyle = "#edcf7b";
      ctx.beginPath();
      ctx.ellipse(x, y + h * 0.58, 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#654a36";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("薯", x, y + h * 0.58 + 4);
    }
  }
  ctx.restore();
}
