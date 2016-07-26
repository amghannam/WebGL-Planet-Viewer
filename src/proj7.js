/* 
 * Ahmed Al-Ghannam, CS-535, Project #7
 * A WebGL program to display the planets based on user choice. 
 * Author contact: amalghannam@crimson.ua.edu
 */

/* 
 * File: proj7.js
 * This project is a simple WebGL-based planet viewer, allowing the user to view and interact with the eight planets 
 * of the solar system.  
 * Note 1: The current file reuses some helper functions from previous projects in the semester.  
 * Note 2: WebGL topics demonstrated by this project include modeling, interaction, animation, texturing, and lighting. 
 * Note 3: Microsoft Edge is strongly recommended for running this program. 
 */

/* Global variable declaration */
var gl;
var canvas;
var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;
var event; // event handling identifier 
var planetTexture;
var planetVertexPositionBuffer;
var planetVertexNormalBuffer;
var planetVertexTextureCoordBuffer;
var planetVertexIndexBuffer;
var shaderProgram;
var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();
var flag = false; // automatic rotation flag (unchecked by default)
var rotationSpeed = 0.80; // default automatic rotation speed
var rotation = [degToRad(1 / 10), degToRad(0 / 10), degToRad(0 / 10)]; // default automatic rotation values
var then = 0 // initial rotation time 

/* Tests if WebGL is supported by the current browser. */
function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialize WebGL. Sorry!");
    }
}

/* Loads the page and all assets. This is the main function. */
window.onload = function start() {
    canvas = document.getElementById("gl-canvas");
    initGL(canvas);
    initShaders();
    initBuffers();
    initTexture();
    initEvtHandlers();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    document.getElementById("rotation").onchange = function () {
        if (flag == false) {
            flag = true;
        } else if (flag == true) {
            flag = false;
        }

        requestAnimationFrame(rotatePlanet);

        /* Function to handle the automatic rotation of a planet (assuming the relevant checkbox is toggled) */ 
        function rotatePlanet(now) {
            if (flag == false) {
                return; // do nothing if unchecked
            } else {
                // Start by clearing the current buffers to avoid an overlap.
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                // Subtract the previous time from the current time.
                now *= 0.001;
                var deltaTime = now - then;
                // Cache the current time to remember it for the next frame.
                then = now;

                // Every frame increases the rotation a little.
                rotation[0] += rotationSpeed * deltaTime;

                // Perform the necessary transformations. 
                mat4.identity(mvMatrix);
                mat4.translate(mvMatrix, [0, 0, -6]);
                mat4.rotate(mvMatrix, rotation[0], [0, 1, 0]); // rotates around y
                mat4.rotate(mvMatrix, rotation[1], [1, 0, 0]); // rotates around x

                // Set the matrix.
                setMatrixUniforms();

                // Draw the geometry.
                gl.drawElements(gl.TRIANGLES, planetVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

                requestAnimationFrame(rotatePlanet);
            }
        }
    }
    render();
}

/* Creates and returns the shader. */
function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

/* Initializes the shaders for the program. */
function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialize shaders!");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    shaderProgram.lightingDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightingDirection");
    shaderProgram.directionalColorUniform = gl.getUniformLocation(shaderProgram, "uDirectionalColor");
}

/* Handles the loading of program textures and texturing assets. */
function configureTexture(texture) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.bindTexture(gl.TEXTURE_2D, null);
}

/* Initializes and sets the texture for the planets based on user input. */
function initTexture() {
    planetTexture = gl.createTexture();
    planetTexture.image = new Image();
    planetTexture.image.onload = function () {
        configureTexture(planetTexture);
    }
    document.getElementById("show").onclick = function () {
        var select = document.getElementById("planetList");
        var selection = select.options[select.selectedIndex].value;
        switch (selection) {
            case "mercury":
                planetTexture.image.src = "mercury.gif";
                break;
            case "venus":
                planetTexture.image.src = "venus.gif";
                break;
            case "earth":
                planetTexture.image.src = "earth.gif";
                break;
            case "mars":
                planetTexture.image.src = "mars.gif";
                break;
            case "jupiter":
                planetTexture.image.src = "jupiter.gif";
                break;
            case "saturn":
                planetTexture.image.src = "saturn.gif";
                break;
            case "uranus":
                planetTexture.image.src = "uranus.gif";
                break;
            case "neptune":
                planetTexture.image.src = "neptune.gif";
                break;
            default:
                window.alert("Please choose a planet to display it.");
        }
    }
}

function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

/* Sets the uniform matrices. */ 
function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);

    var normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}

/* Helper function to convert from degrees to radians. */
function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

var planetRotationMatrix = mat4.create();
mat4.identity(planetRotationMatrix);

/* Initializes the event listeners and handles all event-related actions. */
function initEvtHandlers() {
    // Mouse down handler
    canvas.onmousedown = function () {
        mouseDown = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }

    // Mouse up handler
    document.onmouseup = function () {
        mouseDown = false;
    }

    // Mouse move handler 
    document.onmousemove = function () {
        if (!mouseDown) {
            return;
        }
        var newX = event.clientX;
        var newY = event.clientY;

        var deltaX = newX - lastMouseX
        var newRotationMatrix = mat4.create();
        mat4.identity(newRotationMatrix);
        mat4.rotate(newRotationMatrix, degToRad(deltaX / 10), [0, 1, 0]);

        var deltaY = newY - lastMouseY;
        mat4.rotate(newRotationMatrix, degToRad(deltaY / 10), [1, 0, 0]);

        mat4.multiply(newRotationMatrix, planetRotationMatrix, planetRotationMatrix);

        lastMouseX = newX;
        lastMouseY = newY;
    }
}

/* Initializes, sets, and binds the buffers for our objects. */
function initBuffers() {
    var latitudeBands = 30;
    var longitudeBands = 30;
    var radius = 2;

    var vertexPositionData = [];
    var normalData = [];
    var textureCoordData = [];
    for (var latNumber = 0; latNumber <= latitudeBands; latNumber++) {
        var theta = latNumber * Math.PI / latitudeBands;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        for (var longNumber = 0; longNumber <= longitudeBands; longNumber++) {
            var phi = longNumber * 2 * Math.PI / longitudeBands;
            var sinPhi = Math.sin(phi);
            var cosPhi = Math.cos(phi);

            var x = cosPhi * sinTheta;
            var y = cosTheta;
            var z = sinPhi * sinTheta;
            var u = 1 - (longNumber / longitudeBands);
            var v = 1 - (latNumber / latitudeBands);

            normalData.push(x);
            normalData.push(y);
            normalData.push(z);
            textureCoordData.push(u);
            textureCoordData.push(v);
            vertexPositionData.push(radius * x);
            vertexPositionData.push(radius * y);
            vertexPositionData.push(radius * z);
        }
    }

    var indexData = [];
    for (var latNumber = 0; latNumber < latitudeBands; latNumber++) {
        for (var longNumber = 0; longNumber < longitudeBands; longNumber++) {
            var first = (latNumber * (longitudeBands + 1)) + longNumber;
            var second = first + longitudeBands + 1;
            indexData.push(first);
            indexData.push(second);
            indexData.push(first + 1);

            indexData.push(second);
            indexData.push(second + 1);
            indexData.push(first + 1);
        }
    }

    planetVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, planetVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalData), gl.STATIC_DRAW);
    planetVertexNormalBuffer.itemSize = 3;
    planetVertexNormalBuffer.numItems = normalData.length / 3;

    planetVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, planetVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordData), gl.STATIC_DRAW);
    planetVertexTextureCoordBuffer.itemSize = 2;
    planetVertexTextureCoordBuffer.numItems = textureCoordData.length / 2;

    planetVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, planetVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositionData), gl.STATIC_DRAW);
    planetVertexPositionBuffer.itemSize = 3;
    planetVertexPositionBuffer.numItems = vertexPositionData.length / 3;

    planetVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planetVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);
    planetVertexIndexBuffer.itemSize = 1;
    planetVertexIndexBuffer.numItems = indexData.length;
}

/* Generates the overall scene, including lighting assets. */
function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

    var lighting = document.getElementById("lighting").checked;
    gl.uniform1i(shaderProgram.useLightingUniform, lighting);
    if (lighting) {
        gl.uniform3f(
            shaderProgram.ambientColorUniform,
            parseFloat(document.getElementById("ambientR").value),
            parseFloat(document.getElementById("ambientG").value),
            parseFloat(document.getElementById("ambientB").value)
        );

        var lightingDirection = [-1.0, -1.0, -1.0];
        var adjustedLD = vec3.create();
        vec3.normalize(lightingDirection, adjustedLD);
        vec3.scale(adjustedLD, -1);
        gl.uniform3fv(shaderProgram.lightingDirectionUniform, adjustedLD);

        gl.uniform3f(shaderProgram.directionalColorUniform, 0.8, 0.8, 0.8);
    }

    mat4.identity(mvMatrix);

    mat4.translate(mvMatrix, [0, 0, -6]);

    mat4.multiply(mvMatrix, planetRotationMatrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, planetTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, planetVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, planetVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, planetVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, planetVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, planetVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, planetVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planetVertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, planetVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

/* Renders the final scene for the user. */
function render() {
    requestAnimFrame(render);
    drawScene();
}
