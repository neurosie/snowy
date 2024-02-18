<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import * as fabric from "fabric";
import { closestPointOnPolygon, cutPolygon } from "../geometry";

function color(val: string) {
  return "#" + new fabric.Color(val).toHex();
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasObj = shallowRef<fabric.Canvas | null>(null);

enum UiState {
  EMPTY,
  SNIPPING,
  TOSSING,
}

onMounted(() => {
  if (!canvasRef.value) return;
  const canvas = new fabric.Canvas(canvasRef.value, {
    width: 500,
    height: 500,
    backgroundColor: "white",
    selection: false,
    targetFindTolerance: 10,
    perPixelTargetFind: true,
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
    objectCaching: false,
  });
  const myShapeFill = new fabric.Polygon(myShapePoints, {
    top: 100,
    left: 100,
    fill: color("hsl(190, 90%, 80%)"),
    selectable: false,
    objectCaching: false,
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
    evented: false,
    fill: "transparent",
    stroke: "black",
    strokeDashArray: [4, 4],
    strokeWidth: 2,
    objectCaching: false,
  });
  canvas.add(snipPath);
  const nextSnipLine = new fabric.Polyline([], {
    selectable: false,
    evented: false,
    stroke: "hsl(0, 25%, 15%)",
    strokeDashArray: [4, 4],
    strokeWidth: 2,
    objectCaching: false,
  });
  canvas.add(nextSnipLine);
  let uiState = UiState.EMPTY;

  myShapeOutline.on("mousemove", (e) => {
    if (uiState === UiState.EMPTY || uiState === UiState.SNIPPING) {
      const [snappedPoint, _] = closestPointOnPolygon(
        myShapeOutline,
        e.scenePoint,
      );
      hoverPoint.setXY(snappedPoint);
      hoverPoint.set({ visible: true });
      if (uiState === UiState.SNIPPING) {
        nextSnipLine.points = [snipPath.points.slice(-1)[0], snappedPoint];
      }
      canvas.requestRenderAll();
    }
  });
  myShapeOutline.on("mouseout", () => {
    hoverPoint.set({ visible: false });
    canvas.requestRenderAll();
  });

  myShapeOutline.on("mousedown", (e) => {
    if (!(uiState === UiState.EMPTY || uiState === UiState.SNIPPING)) return;
    const [snappedPoint, _] = closestPointOnPolygon(
      myShapeOutline,
      e.scenePoint,
    );
    snipPath.points.push(snappedPoint);
    if (uiState === UiState.EMPTY) {
      uiState = UiState.SNIPPING;
    } else if (uiState === UiState.SNIPPING) {
      uiState = UiState.TOSSING;
      nextSnipLine.points = [];
      const [pointsA, pointsB] = cutPolygon(myShapeOutline, snipPath.points);
      const shapeA = new fabric.Polygon(pointsA, {
        fill: color("hsl(30, 0%, 20%)"),
        opacity: 0.01,
        hoverCursor: 'url("trash.svg"), pointer',
        selectable: false,
      });
      const shapeB = new fabric.Polygon(pointsB, {
        fill: color("hsl(50, 0%, 20%)"),
        opacity: 0.01,
        hoverCursor: 'url("trash.svg"), pointer',
        selectable: false,
      });
      [shapeA, shapeB].forEach((shape, index, array) => {
        shape.on("mouseover", () => {
          shape.set({ opacity: 0.5 });
          canvas.requestRenderAll();
        });
        shape.on("mouseout", () => {
          shape.set({ opacity: 0.01 });
          canvas.requestRenderAll();
        });
        shape.on("mousedown", () => {
          const winner = array[Number(!index)]; // lol
          myShapeFill.points = winner.points;
          myShapeOutline.points = winner.points;
          myShapeFill.set({ top: 0, left: 0 });
          myShapeOutline.set({ top: 0, left: 0 });
          snipPath.points = [];
          uiState = UiState.EMPTY;
          canvas.remove(shapeA, shapeB);
        });
      });
      canvas.add(shapeA);
      canvas.add(shapeB);
      canvas.bringObjectToFront(snipPath);
    }
  });

  myShapeFill.on("mousemove", (e) => {
    if (uiState === UiState.SNIPPING) {
      hoverPoint.setXY(e.scenePoint);
      hoverPoint.set({ visible: true });
      nextSnipLine.points = [snipPath.points.slice(-1)[0], e.scenePoint];
      canvas.requestRenderAll();
    }
  });
  myShapeFill.on("mousedown", (e) => {
    if (uiState === UiState.SNIPPING) {
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
