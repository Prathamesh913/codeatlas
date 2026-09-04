// U7 fixture — the exact context that polluted CinePrint aliases in 4B.2
// ("Bebas Neue" became an entity alias from canvas font configuration).

export function drawTicket(ctx) {
  ctx.font = 'bold 52px "Bebas Neue", sans-serif';
  ctx.fillText("CinePrint", 40, 80);
}
