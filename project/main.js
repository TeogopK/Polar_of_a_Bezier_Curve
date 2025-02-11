const canvas = document.getElementById('webgl-canvas');
const gl = canvas.getContext('webgl', { antialias: true });

if (!gl) {
    console.error('WebGL not supported, falling back on experimental-webgl');
    gl = canvas.getContext('experimental-webgl', { antialias: true });
}

if (!gl) {
    alert('Your browser does not support WebGL');
}
// Vertex Shader
const vsSource = `
    attribute vec4 aVertexPosition;
    uniform float uPointSize; // Uniform for point size
    void main() {
        gl_Position = aVertexPosition;
        gl_PointSize = uPointSize; // Use the uniform for point size
    }
`;

// Fragment Shader
const fsSource = `
    precision mediump float;
    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
        float distance = length(coord);

        if (distance > 0.5) {
            discard;
        }

        gl_FragColor = vec4(0.1, 0.1, 0.8, 1.0); // Blue color
    }
`;

// Initialize Shaders
const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
const shaderProgram = initShaderProgram(gl, vertexShader, fragmentShader);

// Helper Functions
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

// Global Variables
let points = [];
let selectedPointIndex = -1; // Track the index of the selected point (-1 means no point is selected)
let pointSize = 9.0; // Initial point size

// Resize Canvas to Fit CSS Dimensions
function resizeCanvas() {
    // Parse CSS dimensions
    const canvasStyle = window.getComputedStyle(canvas);
    const canvasWidth = parseFloat(canvasStyle.width);
    const canvasHeight = parseFloat(canvasStyle.height);

    // Set canvas dimensions
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Update WebGL viewport
    gl.viewport(0, 0, canvas.width, canvas.height);

    render();
}

// Normalize Mouse Coordinates to WebGL Clip Space
function getNormalizedMouseCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / canvas.width) * 2 - 1; // Normalize to [-1, 1]
    const y = 1 - ((event.clientY - rect.top) / canvas.height) * 2; // Normalize to [-1, 1]

    return [x, y];
}

// Event Listener for Key Press
window.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') { // Increase point size
        pointSize += 1.0;
        console.log(`Point size increased to: ${pointSize}`);
        render();
    } else if (event.key === '-' || event.key === '_') { // Decrease point size
        pointSize = Math.max(1.0, pointSize - 1.0); // Ensure point size doesn't go below 1.0
        console.log(`Point size decreased to: ${pointSize}`);
        render();
    } else if (event.key === 'z' || event.key === 'Z') { // Undo (remove last point)
        if (points.length > 0) {
            points.pop();
            console.log('Undo');
            render();
        }
    }
});

// Event Listener for Click
canvas.addEventListener('click', (event) => {
    if (event.button === 0) { // Left-click
        const [x, y] = getNormalizedMouseCoordinates(event);

        if (event.shiftKey) { // Shift + Left Click: Remove the clicked point
            const clickedPointIndex = findClickedPointIndex(x, y);
            if (clickedPointIndex !== -1) {
                points.splice(clickedPointIndex, 1); // Remove the clicked point
                console.log(`Point removed at index: ${clickedPointIndex}`); // Debug log
                render();
            }
        } else if (!event.ctrlKey) { // Regular Left Click: Add a new point
            points.push([x, y]);
            render();
        }
    }
});

// Helper Function to Find Clicked Point Index
function findClickedPointIndex(x, y) {
    const threshold = 0.05; // Threshold for point selection
    for (let i = 0; i < points.length; i++) {
        const dx = points[i][0] - x;
        const dy = points[i][1] - y;
        if (dx * dx + dy * dy < threshold * threshold) {
            return i; // Return the index of the clicked point
        }
    }
    return -1; // No point found
}

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left-click
        const [x, y] = getNormalizedMouseCoordinates(event);

        if (event.ctrlKey) { // Ctrl + Left Click: Select the clicked point for dragging
            selectedPointIndex = findClickedPointIndex(x, y);
            console.log(`Point selected at index: ${selectedPointIndex}`); // Debug log
        }
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (selectedPointIndex !== -1 && event.ctrlKey) { // If a point is selected and Ctrl is held down
        const [x, y] = getNormalizedMouseCoordinates(event);
        points[selectedPointIndex] = [x, y]; // Update the point's position
        render();
    }
});

canvas.addEventListener('mouseup', () => {
    selectedPointIndex = -1; // Deselect the point
});

window.addEventListener('resize', resizeCanvas);

// Render Function
function render() {
    console.log(points);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (points.length > 0) {
        const vertices = points.flat(); // Flatten the array of points

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        const positionAttributeLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        // Pass the point size to the shader
        const pointSizeLocation = gl.getUniformLocation(shaderProgram, 'uPointSize');
        gl.useProgram(shaderProgram);
        gl.uniform1f(pointSizeLocation, pointSize);

        gl.drawArrays(gl.POINTS, 0, points.length);

        // Draw the lines connecting the points
        if (points.length >= 2) {
            gl.drawArrays(gl.LINE_STRIP, 0, points.length);
        }
    }
}

resizeCanvas();
render();