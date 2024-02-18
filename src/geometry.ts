import * as fabric from "fabric";

/**
 * Find the closest point on a line segment from a test point.
 *
 * Based on https://stackoverflow.com/a/6853926
 *
 * @param a Segment start point
 * @param b Segment end point
 * @param c Test point
 * @returns [point on segment, distance from test point]
 */
export function closestPointOnSegment(
  a: fabric.XY,
  b: fabric.XY,
  c: fabric.XY,
): [fabric.XY, number] {
  const A = c.x - a.x;
  const B = c.y - a.y;
  const C = b.x - a.x;
  const D = b.y - a.y;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq != 0)
    //in case of 0 length line
    param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = a.x;
    yy = a.y;
  } else if (param > 1) {
    xx = b.x;
    yy = b.y;
  } else {
    xx = a.x + param * C;
    yy = a.y + param * D;
  }

  const dx = c.x - xx;
  const dy = c.y - yy;
  return [{ x: xx, y: yy }, Math.sqrt(dx * dx + dy * dy)];
}

/**
 * Find the closest point on a polygon from a test point.
 *
 * If the resulting point is a vertex, the returned segment index will match
 * the segment the point is the start of.
 *
 * Partially based on https://gis.stackexchange.com/a/170225
 *
 * @param scenePoint Test point, in scene coordinates
 * @param poly Polygon to test
 * @returns [point on polygon, segment index]
 */
export function closestPointOnPolygon(
  poly: fabric.Polygon,
  scenePoint: fabric.Point,
): [fabric.Point, number] {
  const point = scenePoint.subtract({ x: poly.left, y: poly.top });
  const polyPoints = poly.points;
  let shortestDist = Number.MAX_VALUE;
  let closestPointOnPoly = polyPoints[0];
  let segmentIndex = 0;

  polyPoints.forEach((p1, index) => {
    const prev = (index === 0 ? polyPoints.length : index) - 1,
      p2 = polyPoints[prev],
      line = new fabric.Point(p2).subtract(p1);

    if (line.eq({ x: 0, y: 0 })) return;

    const [closestPoint, distance] = closestPointOnSegment(p1, p2, point);
    if (distance <= shortestDist) {
      closestPointOnPoly = closestPoint;
      shortestDist = distance;
      segmentIndex = prev;
    }
  });
  return [
    new fabric.Point(closestPointOnPoly).add({
      x: poly.left,
      y: poly.top,
    }),
    segmentIndex,
  ];
}

/**
 * Takes a polygon and a cut path with endpoints on the polygon, and returns two
 * polygons resulting from cutting along the path.
 *
 * @param poly Closed polygon to divide
 * @param cut A path with endpoints on the polygon
 */
export function cutPolygon(
  poly: fabric.Polygon,
  cut: fabric.XY[],
): [fabric.XY[], fabric.XY[]] {
  if (cut.length < 2) {
    throw "cut path is too short";
  }
  const cutStart = new fabric.Point(cut[0]);
  const cutEnd = new fabric.Point(cut[cut.length - 1]);
  const [startPoint, startSegmentIndex] = closestPointOnPolygon(poly, cutStart);
  const [endPoint, endSegmentIndex] = closestPointOnPolygon(poly, cutEnd);
  const polyPoints = poly.points.map((p) => ({
    x: p.x + poly.left,
    y: p.y + poly.top,
  }));
  // gather all significant exterior points in clockwise order
  const vertices: fabric.XY[] = [];
  for (let i = 0; i < polyPoints.length; i++) {
    vertices.push(polyPoints[i]);
    if (
      startSegmentIndex === i &&
      endSegmentIndex === i &&
      startPoint != polyPoints[i] &&
      endPoint != polyPoints[i]
    ) {
      // edge case where cut starts and ends on same side, neither on end point.
      // make sure points are added in clockwise order.
      // manhattan distance is ok here bc all points are co-linear, it's just for sorting.
      const startDist =
        Math.abs(startPoint.x - polyPoints[i].x) +
        Math.abs(startPoint.y - polyPoints[i].y);
      const endDist =
        Math.abs(endPoint.x - polyPoints[i].x) +
        Math.abs(endPoint.y - polyPoints[i].y);
      if (startDist < endDist) {
        vertices.push(startPoint, endPoint);
      } else {
        vertices.push(endPoint, startPoint);
      }
    } else if (startSegmentIndex === i && startPoint != polyPoints[i]) {
      vertices.push(startPoint);
    } else if (endSegmentIndex === i && endPoint != polyPoints[i]) {
      vertices.push(endPoint);
    }
  }
  const startVerticeIndex = vertices.indexOf(startPoint),
    endVerticeIndex = vertices.indexOf(endPoint);
  let shape1, shape2;
  // add exterior points from polygon
  if (startVerticeIndex < endVerticeIndex) {
    shape1 = vertices.slice(startVerticeIndex, endVerticeIndex + 1);
    shape2 = [
      ...vertices.slice(endVerticeIndex, vertices.length),
      ...vertices.slice(0, startVerticeIndex + 1),
    ];
  } else {
    shape1 = [
      ...vertices.slice(startVerticeIndex, vertices.length),
      ...vertices.slice(0, endVerticeIndex + 1),
    ];
    shape2 = vertices.slice(endVerticeIndex, startVerticeIndex + 1);
  }
  // add interior points from cut
  const cutReverse = cut.slice(1, -1).reverse();
  shape1.push(...cutReverse);
  shape2.push(...cut.slice(1, -1));
  return [shape1, shape2];
}
