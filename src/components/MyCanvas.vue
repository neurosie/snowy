<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import * as fabric from "fabric";

function color(val: string) {
  return "#" + new fabric.Color(val).toHex();
}

// Based on https://gis.stackexchange.com/a/170225
function magnitude(point: fabric.Point) {
  return point.distanceFrom({ x: 0, y: 0 });
}
function closestPointOnPolygon(
  point: fabric.Point,
  poly: fabric.Point[],
): fabric.Point {
  let shortestDist = Number.MAX_VALUE;
  let closestPointOnPoly = poly[0];

  poly.forEach((p1, index) => {
    const prev = (index === 0 ? poly.length : index) - 1,
      p2 = poly[prev],
      line = p2.subtract(p1);

    if (line.eq({ x: 0, y: 0 })) return;

    const norm = new fabric.Point(-line.y, line.x),
      x1 = point.x,
      x2 = norm.x,
      x3 = p1.x,
      x4 = line.x,
      y1 = point.y,
      y2 = norm.y,
      y3 = p1.y,
      y4 = line.y;
    let j;
    if (y2 === 0) {
      j = (y1 - y3) / y4;
    } else {
      j = (x3 - x1 - (x2 * y3) / y2 + (x2 * y1) / y2) / ((x2 * y4) / y2 - x4);
    }

    let currentDistanceToPoly, currentPointToPoly;
    if (j < 0 || j > 1) {
      const a = point.subtract(p1);
      const aLen = magnitude(a);
      const b = point.subtract(p2);
      const bLen = magnitude(b);
      if (a < b) {
        currentPointToPoly = a.scalarMultiply(-1);
        currentDistanceToPoly = aLen;
      } else {
        currentPointToPoly = b.scalarMultiply(-1);
        currentDistanceToPoly = bLen;
      }
    } else {
      if (y2 === 0) {
        currentPointToPoly = new fabric.Point(x3 - x1, 0);
      } else {
        const i = (y3 + j * y4 - y1) / y2;
        currentPointToPoly = norm.scalarMultiply(i);
      }
      currentDistanceToPoly = magnitude(currentPointToPoly);
    }

    if (currentDistanceToPoly < shortestDist) {
      closestPointOnPoly = point.add(currentPointToPoly);
      shortestDist = currentDistanceToPoly;
    }
  });
  return closestPointOnPoly;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasObj = shallowRef<fabric.Canvas | null>(null);

onMounted(() => {
  if (!canvasRef.value) return;
  const canvas = new fabric.Canvas(canvasRef.value, {
    width: 500,
    height: 500,
    backgroundColor: "white",
    selection: false,
    targetFindTolerance: 10,
  });
  canvasObj.value = canvas;

  const SIZE = 300;
  const myShapePoints = [
    { x: 0, y: 0 },
    { x: SIZE, y: 0 },
    { x: SIZE, y: SIZE },
    { x: 0, y: SIZE },
  ];
  const myShapeOutline = new fabric.Polygon(myShapePoints, {
    top: 100 - 2,
    left: 100 - 2,
    fill: "transparent",
    strokeWidth: 4,
    stroke: color("hsl(190, 90%, 30%)"),
    selectable: false,
    padding: 10,
    perPixelTargetFind: true,
    hoverCursor: "pointer",
  });
  const myShapeFill = new fabric.Polygon(myShapePoints, {
    top: 100,
    left: 100,
    fill: color("hsl(190, 90%, 80%)"),
    selectable: false,
  });
  canvas.add(myShapeFill);
  canvas.add(myShapeOutline);

  const RADIUS = 6;
  const hoverPoint = new fabric.Circle({
    radius: RADIUS,
    originX: "center",
    originY: "center",
    fill: color("hsl(20, 70%, 60%)"),
    selectable: false,
    visible: false,
  });
  canvas.add(hoverPoint);

  const snipPath = new fabric.Polyline([], {
    selectable: false,
    fill: "transparent",
    stroke: "black",
    strokeDashArray: [4, 4],
    strokeWidth: 2,
    objectCaching: false,
  });
  canvas.add(snipPath);
  const nextSnipLine = new fabric.Polyline([], {
    selectable: false,
    stroke: "black",
    strokeDashArray: [4, 4],
    strokeWidth: 2,
    objectCaching: false,
  });
  canvas.add(nextSnipLine);
  let isSnipping = false;

  myShapeOutline.on("mousemove", (e) => {
    const snappedPoint = closestPointOnPolygon(
      e.scenePoint,
      myShapeOutline.getCoords(),
    );
    hoverPoint.setXY(snappedPoint);
    hoverPoint.set({ visible: true });
    if (isSnipping) {
      nextSnipLine.points = [snipPath.points.slice(-1)[0], snappedPoint];
    }
    canvas.requestRenderAll();
  });
  myShapeOutline.on("mouseout", () => {
    hoverPoint.set({ visible: false });
    canvas.requestRenderAll();
  });

  myShapeOutline.on("mousedown", (e) => {
    const snappedPoint = closestPointOnPolygon(
      e.scenePoint,
      myShapeOutline.getCoords(),
    );
    isSnipping = !isSnipping;
    snipPath.points.push(snappedPoint);
    if (!isSnipping) {
      // split myShape into 2 polys
      // fabric.Intersection.isPointContained()
    }
  });

  myShapeFill.on("mousemove", (e) => {
    if (isSnipping) {
      hoverPoint.setXY(e.scenePoint);
      hoverPoint.set({ visible: true });
      nextSnipLine.points = [snipPath.points.slice(-1)[0], e.scenePoint];
      canvas.requestRenderAll();
    }
  });
  myShapeFill.on("mousedown", (e) => {
    if (isSnipping) {
      snipPath.points.push(e.scenePoint);
      nextSnipLine.points = [];
    }
  });
});

onUnmounted(async () => {
  // for hot-reloading
  if (canvasObj.value) {
    try {
      await canvasObj.value.dispose();
    } catch (e) {
      /* empty */
    }
  }
});
</script>

<template>
  <canvas ref="canvasRef"></canvas>
</template>

<style scoped></style>
