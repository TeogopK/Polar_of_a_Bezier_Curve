const canvas = document.getElementById('webgl-canvas');
const gl = canvas.getContext('webgl', { antialias: true });

if (!gl) {
    console.error('WebGL not supported, falling back on experimental-webgl');
    gl = canvas.getContext('experimental-webgl', { antialias: true });
}

if (!gl) {
    alert('Your browser does not support WebGL');
}

const vsSource = `
    attribute vec4 aVertexPosition;
    uniform float uPointSize;
    void main() {
        gl_Position = aVertexPosition;
        gl_PointSize = uPointSize;
    }
`;

const fsSource = `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
        float distance = length(coord);

        if (distance > 0.5) {
            discard;
        }

        gl_FragColor = uColor;
    }
`;

const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
const shaderProgram = initShaderProgram(gl, vertexShader, fragmentShader);

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initShaderProgram(gl, vertexShader, fragmentShader) {
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    return shaderProgram;
}

const DEFAULT_POINT_SIZE = 9.0;
const DEFAULT_T = 0.5;

let points = [];
let selectedPointIndex = -1;
let pointSize = DEFAULT_POINT_SIZE;
let t = DEFAULT_T;
let showIntermediate = true;
let showFirstPolar = true;

function resizeCanvas() {

    const canvasStyle = window.getComputedStyle(canvas);
    const canvasWidth = parseFloat(canvasStyle.width);
    const canvasHeight = parseFloat(canvasStyle.height);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    gl.viewport(0, 0, canvas.width, canvas.height);

    render();
}

function getNormalizedMouseCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
    const y = 1 - ((event.clientY - rect.top) / canvas.height) * 2;

    return [x, y];
}

function increasePointSize() {
    pointSize += 1.0;

    render();
}

function decreasePointSize() {
    pointSize = Math.max(1.0, pointSize - 1.0);

    render();
}

function removeLastPoint() {
    if (points.length > 0) {
        points.pop();
        render();
    }
}

function toggleIntermediatePoints() {
    showIntermediate = !showIntermediate;
    render();
}

function toggleFirstPolar() {
    showFirstPolar = !showFirstPolar;
    render();
}

function clearAllPoints() {
    points = [];

    render();
}

function resetToDefaults() {
    points = [];
    pointSize = DEFAULT_POINT_SIZE;
    t = DEFAULT_T;
    tSlider.value = DEFAULT_T;
    tValueDisplay.textContent = DEFAULT_T.toFixed(1);

    render();
}

window.addEventListener('keydown', (event) => {
    switch (event.key) {
        case '+':
        case '=':
            increasePointSize();
            break;
        case '-':
        case '_':
            decreasePointSize();
            break;
        case 'z':
        case 'Z':
            removeLastPoint();
            break;
        case 'i':
        case 'I':
            toggleIntermediatePoints();
            break;
        case 'c':
        case 'C':
            clearAllPoints();
            break;
        case 'r':
        case 'R':
            resetToDefaults();
            break;
        case '[':
            decreaseSliderValue();
            break;
        case ']':
            increaseSliderValue();
            break;
        case 'p':
        case 'P':
            toggleFirstPolar();
            break;
        default:
            break;
    }
});

canvas.addEventListener('click', (event) => {
    if (event.button === 0) {
        const [x, y] = getNormalizedMouseCoordinates(event);

        if (event.shiftKey) {
            const clickedPointIndex = findClickedPointIndex(x, y);
            if (clickedPointIndex !== -1) {
                points.splice(clickedPointIndex, 1);

                render();
            }
        } else if (!event.ctrlKey) {
            points.push([x, y]);
            render();
        }
    }
});

function findClickedPointIndex(x, y) {
    const threshold = 0.05;
    for (let i = 0; i < points.length; i++) {
        const dx = points[i][0] - x;
        const dy = points[i][1] - y;
        if (dx * dx + dy * dy < threshold * threshold) {
            return i;
        }
    }
    return -1;
}

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
        const [x, y] = getNormalizedMouseCoordinates(event);

        if (event.ctrlKey) {
            selectedPointIndex = findClickedPointIndex(x, y);

        }
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (selectedPointIndex !== -1 && event.ctrlKey) {
        const [x, y] = getNormalizedMouseCoordinates(event);
        points[selectedPointIndex] = [x, y];
        render();
    }
});

canvas.addEventListener('mouseup', () => {
    selectedPointIndex = -1;
});

window.addEventListener('resize', resizeCanvas);

function deCasteljau(points, t) {
    let tmpPoints = [...points];
    for (let r = 1; r < points.length; r++) {
        for (let i = 0; i < points.length - r; i++) {
            tmpPoints[i] = [
                (1 - t) * tmpPoints[i][0] + t * tmpPoints[i + 1][0],
                (1 - t) * tmpPoints[i][1] + t * tmpPoints[i + 1][1]
            ];
        }
    }
    return tmpPoints[0];
}

function renderBezierCurve() {
    if (points.length > 2) {
        const curveVertices = [];
        for (let t = 0; t <= 1; t += 0.01) {
            const point = deCasteljau(points, t);
            curveVertices.push(point[0], point[1]);
        }

        const curveBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(curveVertices), gl.STATIC_DRAW);

        const positionAttributeLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        const colorLocation = gl.getUniformLocation(shaderProgram, 'uColor');
        gl.uniform4f(colorLocation, 0.4, 0.7, 1.0, 1.0);
        gl.drawArrays(gl.LINE_STRIP, 0, curveVertices.length / 2);
    }
}

const tSlider = document.getElementById('t-slider');
const tValueDisplay = document.getElementById('t-value');

tSlider.addEventListener('input', () => {
    t = parseFloat(tSlider.value);
    tValueDisplay.textContent = t.toFixed(1);
    render();
});

function increaseSliderValue() {
    const step = 0.1;
    t = Math.min(1, t + step);
    tSlider.value = t;
    tValueDisplay.textContent = t.toFixed(1);
    render();
}

function decreaseSliderValue() {
    const step = 0.1;
    t = Math.max(0, t - step);
    tSlider.value = t;
    tValueDisplay.textContent = t.toFixed(1);
    render();
}

const toggleIntermediateButton = document.getElementById('toggle-intermediate');
const toggleFirstPolarButton = document.getElementById('toggle-first-polar');
const increasePointSizeButton = document.getElementById('increase-point-size');
const decreasePointSizeButton = document.getElementById('decrease-point-size');
const removeLastPointButton = document.getElementById('remove-last-point');
const clearPointsButton = document.getElementById('clear-points');
const resetButton = document.getElementById('reset');

toggleIntermediateButton.addEventListener('click', toggleIntermediatePoints);
toggleFirstPolarButton.addEventListener('click', toggleFirstPolar);
increasePointSizeButton.addEventListener('click', increasePointSize);
decreasePointSizeButton.addEventListener('click', decreasePointSize);
removeLastPointButton.addEventListener('click', removeLastPoint);
clearPointsButton.addEventListener('click', clearAllPoints);
resetButton.addEventListener('click', resetToDefaults);

function computeIntermediatePoints(points, t) {
    const intermediatePoints = [];
    for (let i = 0; i < points.length - 1; i++) {
        const x = (1 - t) * points[i][0] + t * points[i + 1][0];
        const y = (1 - t) * points[i][1] + t * points[i + 1][1];
        intermediatePoints.push([x, y]);
    }
    return intermediatePoints;
}

function renderIntermediatePoints() {
    if (points.length > 2 && showIntermediate) {
        const intermediatePoints = computeIntermediatePoints(points, t);

        const intermediateVertices = intermediatePoints.flat();
        const intermediateBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, intermediateBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(intermediateVertices), gl.STATIC_DRAW);

        const positionAttributeLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        const colorLocation = gl.getUniformLocation(shaderProgram, 'uColor');
        gl.uniform4f(colorLocation, 0.1, 0.8, 0.2, 1.0);
        gl.drawArrays(gl.POINTS, 0, intermediatePoints.length);

        if (intermediatePoints.length >= 2) {
            gl.uniform4f(colorLocation, 0.1, 0.8, 0.2, 1.0);
            gl.drawArrays(gl.LINE_STRIP, 0, intermediatePoints.length);
        }
    }
}

function computeFirstIteration(points, t) {
    const firstIteration = [];
    for (let i = 0; i < points.length - 1; i++) {
        const x = (1 - t) * points[i][0] + t * points[i + 1][0];
        const y = (1 - t) * points[i][1] + t * points[i + 1][1];
        firstIteration.push([x, y]);
    }
    return firstIteration;
}

function renderPolarCurve() {
    if (points.length > 1 && showFirstPolar) {
        const polarControlPoints = computeFirstIteration(points, t);

        const polarVertices = [];
        for (let t2 = 0; t2 <= 1; t2 += 0.01) {
            const point = deCasteljau(polarControlPoints, t2);
            polarVertices.push(point[0], point[1]);
        }

        const polarBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, polarBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(polarVertices), gl.STATIC_DRAW);

        const positionAttributeLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        const colorLocation = gl.getUniformLocation(shaderProgram, 'uColor');
        gl.uniform4f(colorLocation, 0.8, 0.2, 0.2, 1.0); // Red color for polar curve
        gl.drawArrays(gl.LINE_STRIP, 0, polarVertices.length / 2);
    }
}

function render() {

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (points.length > 0) {
        const vertices = points.flat();

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        const positionAttributeLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        const pointSizeLocation = gl.getUniformLocation(shaderProgram, 'uPointSize');
        const colorLocation = gl.getUniformLocation(shaderProgram, 'uColor');
        gl.useProgram(shaderProgram);
        gl.uniform1f(pointSizeLocation, pointSize);

        gl.uniform4f(colorLocation, 0.1, 0.1, 0.8, 1.0);
        gl.drawArrays(gl.POINTS, 0, points.length);

        if (points.length >= 2) {
            gl.uniform4f(colorLocation, 0.1, 0.1, 0.8, 1.0);
            gl.drawArrays(gl.LINE_STRIP, 0, points.length);
        }

        renderBezierCurve();
        renderIntermediatePoints();
        renderPolarCurve();
    }
}

resetToDefaults()
resizeCanvas();
render();