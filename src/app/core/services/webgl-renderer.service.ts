import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WebGLRendererService {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private textureBuffer: WebGLBuffer | null = null;

  // 頂點著色器
  private readonly vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0, 1);
      v_texCoord = a_texCoord;
    }
  `;

  // 片段著色器
  private readonly fragmentShaderSource = `
    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    void main() {
      gl_FragColor = texture2D(u_image, v_texCoord);
    }
  `;

  public initialize(canvas: HTMLCanvasElement): void {
    // 獲取WebGL上下文
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true
    });

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    // 創建著色器程序
    this.program = this.createProgram();
    if (!this.program) {
      throw new Error('Failed to create shader program');
    }
    
    // 創建緩衝區
    this.createBuffers();
    
    // 創建紋理
    this.createTexture();
    
    // 設置視口
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  private createProgram(): WebGLProgram | null {
    if (!this.gl) return null;

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, this.vertexShaderSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, this.fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = this.gl.createProgram();
    if (!program) {
      return null;
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Unable to initialize shader program:', this.gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) {
      return null;
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  private createBuffers(): void {
    if (!this.gl) return;

    // 創建頂點緩衝區
    this.vertexBuffer = this.gl.createBuffer();
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    
    // 創建紋理坐標緩衝區
    this.textureBuffer = this.gl.createBuffer();
    const textureCoords = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0
    ]);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, textureCoords, this.gl.STATIC_DRAW);
  }

  private createTexture(): void {
    if (!this.gl) return;

    this.texture = this.gl.createTexture();
    if (!this.texture) {
      throw new Error('Failed to create WebGL texture');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    
    // 設置紋理參數
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  }

  public render(frameBuffer: Uint32Array): void {
    if (!this.gl || !this.program || !this.texture) return;

    // 使用著色器程序
    this.gl.useProgram(this.program);
    
    // 設置頂點屬性
    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureBuffer);
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    // 更新紋理數據
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      240,
      160,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      new Uint8Array(frameBuffer.buffer)
    );
    
    // 繪製
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
} 