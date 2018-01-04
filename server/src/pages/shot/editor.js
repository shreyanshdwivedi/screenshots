const React = require("react");
const { Localized } = require("fluent-react/compat");
const sendEvent = require("../../browser-send-event.js");

let mousedown = false;
let resizing = false;
let creating = false;
let resizeDirection;
let resizeStartPos;
let selectedPos = {};
let movingPos = {};


const movements = {
  topLeft: ["x1", "y1"],
  top: [null, "y1"],
  topRight: ["x2", "y1"],
  left: ["x1", null],
  right: ["x2", null],
  bottomLeft: ["x1", "y2"],
  bottom: [null, "y2"],
  bottomRight: ["x2", "y2"],
  move: ["*", "*"]
};

exports.Editor = class Editor extends React.Component {
  constructor(props) {
    super(props);
    this.mousedown = this.mousedown.bind(this);
    this.mouseup = this.mouseup.bind(this);
    this.mousemove = this.mousemove.bind(this);
    this.draw = this.draw.bind(this);
    this.setPosition = this.setPosition.bind(this);
    this.canvasWidth = this.props.clip.image.dimensions.x;
    this.canvasHeight = this.props.clip.image.dimensions.y;
    this.state = {
      tool: 'pen',
      color: '#000',
      size: '5'
    };
  }

  render() {
    let toolBar = this.cropToolBar || this.renderToolBar();
    return <div>
      { toolBar }
      <div className="main-container inverse-color-scheme">
        <div className={`canvas-container ${this.state.tool}`} id="canvas-container" ref={(canvasContainer) => this.canvasContainer = canvasContainer}>
          <canvas className="image-holder centered" id="image-holder" ref={(image) => { this.imageCanvas = image }} height={ this.canvasHeight } width={ this.canvasWidth } style={{height: this.canvasHeight, width: this.canvasWidth}}></canvas>
          <canvas className="temp-highlighter centered" id="highlighter" ref={(highlighter) => { this.highlighter = highlighter }} height={ this.canvasHeight } width={ this.canvasWidth }></canvas>
          <canvas className="crop-tool centered" id="crop-tool" ref={(cropper) => { this.cropper = cropper }} height={this.canvasHeight} width={this.canvasWidth}></canvas>
          <div className="crop-container centered" ref={(cropContainer) => this.cropContainer = cropContainer} style={{height: this.canvasHeight, width: this.canvasWidth}}></div>
        </div>
      </div>
    </div>
  }

  renderToolBar() {
    let penState = this.state.tool == "pen" ? 'active' : 'inactive';
    let highlighterState = this.state.tool == "highlighter" ? 'active' : 'inactive';
    return <div className="editor-header default-color-scheme">
      <div className="shot-main-actions annotation-actions">
        <div className="annotation-tools">
          <Localized id="annotationCropButton">
            <button className={`button transparent crop-button`} id="crop" onClick={this.onClickCrop.bind(this)} title="Crop"></button>
          </Localized>
          <Localized id="annotationPenButton">
            <button className={`button transparent pen-button ${penState}`} id="pen" onClick={this.onClickPen.bind(this)} title="pen"></button>
          </Localized>
          <Localized id="annotationHighlighterButton">
            <button className={`button transparent highlight-button ${highlighterState}`} id="highlight" onClick={this.onClickHighlight.bind(this)} title="highlighter"></button>
          </Localized>
          <ColorPicker setColor={this.setColor.bind(this)} />
          <Localized id="annotationClearButton">
            <button className={`button transparent clear-button`} id="clear" onClick={this.onClickClear.bind(this)} title="clear"></button>
          </Localized>
        </div>
      </div>
      <div className="shot-alt-actions annotation-alt-actions">
        <Localized id="annotationSaveButton">
          <button className="button primary save" id="save" onClick={ this.onClickSave.bind(this) }>Save</button>
        </Localized>
        <Localized id="annotationCancelButton">
          <button className="button secondary cancel" id="cancel" onClick={this.onClickCancel.bind(this)}>Cancel</button>
        </Localized>
      </div>
    </div>
  }

  setColor(color) {
    this.setState({color});
  }

  componentDidUpdate() {
    this.edit();
  }

  onClickCrop() {
    this.setState({tool: 'crop'});
    this.cropToolBar = <div className="editor-header default-color-scheme"><div className="annotation-tools">
      <Localized id="annotationConfirmCropButton">
        <button className={`button transparent confirm-crop`} id="confirm-crop" onClick={this.onClickConfirmCrop.bind(this)}>Crop</button>
      </Localized>
      <Localized id="annotationCancelCropButton">
        <button className={`button transparent cancel-crop`} id="cancel-crop" onClick={this.onClickCancelCrop.bind(this)}>Cancel</button>
      </Localized>
    </div></div>;
  }

  onClickConfirmCrop() {
    let x1 = selectedPos.left;
    let x2 = selectedPos.right;
    let y1 = selectedPos.top;
    let y2 = selectedPos.bottom;
    x1 = Math.max(x1, 0);
    y1 = Math.max(y1, 0);
    x2 = Math.min(x2, this.canvasWidth);
    y2 = Math.min(this.canvasHeight, y2);
    let cropWidth = x2 - x1;
    let cropHeight = y2 - y1;
    let croppedImage = document.createElement('canvas');
    croppedImage.width = Math.floor(cropWidth);
    croppedImage.height = Math.floor(cropHeight);
    let croppedContext = croppedImage.getContext("2d");
    croppedContext.drawImage(this.imageCanvas, x1, y1, croppedImage.width, croppedImage.height, 0, 0, croppedImage.width, croppedImage.height);
    croppedContext.globalCompositeOperation = 'multiply';
    croppedContext.drawImage(this.highlighter, x1, y1, croppedImage.width, croppedImage.height, 0, 0, croppedImage.width, croppedImage.height);
    let img = new Image();
    let imageContext = this.imageCanvas.getContext('2d');
    img.crossOrigin = 'Anonymous';
    let width = cropWidth;
    let height = cropHeight;
    img.onload = () => {
      imageContext.drawImage(img, 0, 0, width, height);
    }
    this.imageContext = imageContext;
    img.src = croppedImage.toDataURL("image/png");
    this.canvasWidth = cropWidth;
    this.canvasHeight = cropHeight;
    this.onClickCancelCrop();
  }

  onClickCancelCrop() {
    this.removeCropBox();
    this.cropToolBar = null;
    this.setState({tool: 'pen'});
  }

  mouseup(e) {
    mousedown = false;
    creating = false;
    resizing = false;
  }

  mousedown(e) {
    mousedown = true;
    let rect = this.cropContainer.getBoundingClientRect();
    if (!this.cropBox) {
      creating = true;
      selectedPos.top = e.clientY - rect.top;
      selectedPos.left = e.clientX - rect.left;
      this.displayCropBox(selectedPos);
    } else {
      let target = e.target;
      let direction = this.findClickedArea(target);
      if (direction) {
        resizing = true;
        resizeDirection = direction;
        resizeStartPos = {x: e.clientX - rect.left, y: e.clientY - rect.top};
        movingPos = JSON.parse(JSON.stringify(selectedPos));
        this.resizeCropBox(e, direction);
      }
    }
  }

  mousemove(e) {
    let rect = this.cropContainer.getBoundingClientRect();
    if (mousedown && creating) {
      selectedPos.bottom = Math.min(this.canvasHeight, e.clientY - rect.top);
      selectedPos.right = Math.min(this.canvasWidth, e.clientX - rect.left);
      selectedPos = this.flipCoords(selectedPos);
      this.displayCropBox(selectedPos);
    }
    if (mousedown && resizing) {
      this.resizeCropBox(e);
    }
  }

  resizeCropBox(event, direction) {
    let rect = this.cropContainer.getBoundingClientRect();
    let diffX = event.clientX - rect.left - resizeStartPos.x;
    let diffY = event.clientY - rect.top - resizeStartPos.y;
    let movement = movements[resizeDirection];
    if (movement[0]) {
      let moveX = movement[0];
      if (moveX.includes("*")) {
        selectedPos.right = Math.min(this.canvasWidth, movingPos.right + diffX);
        selectedPos.left = Math.max(0, movingPos.left + diffX);
      }
      if (moveX.includes('x2')) {
        selectedPos.right = Math.min(this.canvasWidth, resizeStartPos.x + diffX);
      }
      if (moveX.includes('x1')) {
        selectedPos.left = Math.max(0, resizeStartPos.x + diffX);
      }
    }
    if (movement[1]) {
      let moveY = movement[1];
      if (moveY.includes("*")) {
        selectedPos.top = Math.max(0, movingPos.top + diffY);
        selectedPos.bottom = Math.min(this.canvasHeight, movingPos.bottom + diffY);
      }
      if (moveY.includes('y2')) {
        selectedPos.bottom = Math.min(this.canvasHeight, resizeStartPos.y + diffY);
      }
      if (moveY.includes('y1')) {
        selectedPos.top = Math.max(0, resizeStartPos.y + diffY);
      }
    }
    selectedPos = this.flipCoords(selectedPos);
    this.displayCropBox(selectedPos, direction);
  }

  flipCoords(pos) {
    let temp;
    if (pos.right <= pos.left) {
      temp = pos.left;
      pos.left = pos.right;
      pos.right = temp;
    }
    if (pos.bottom <= pos.top) {
      temp = pos.top;
      pos.top = pos.bottom;
      pos.bottom = temp;
    }
    return pos;
  }

  findClickedArea(target) {
    let movements = ["topLeft", "top", "topRight", "left", "right", "bottomLeft", "bottom", "bottomRight"];
      if (target.classList.contains("mover-target") || target.classList.contains("mover")) {
        for (let name of movements) {
          if (target.classList.contains("direction-" + name) || target.parentNode.classList.contains("direction-" + name)) {
            return name;
          }
        }
      } else if (target.classList.contains("highlight")) {
        return "move";
      }
    if (target.classList.contains("bghighlight")) {
      this.onClickCancelCrop();
    }
    return null;
  }

  removeCropBox() {
    while (this.cropContainer.firstChild) {
      this.cropContainer.firstChild.remove();
    }
    this.cropBox = null;
    selectedPos = {};
    movingPos = {};
    resizeDirection = null;
    resizing = false;
    creating = false;
  }

  displayCropBox(pos, direction) {
    this.createCropBox();
    this.cropBox.style.position = "absolute";
    this.cropBox.style.top = pos.top + "px";
    this.cropBox.style.left = pos.left + "px";
    this.cropBox.style.height = pos.bottom - pos.top + "px";
    this.cropBox.style.width = pos.right - pos.left + "px";
    this.bgTop.style.top = "0px";
    this.bgTop.style.height = pos.top + "px";
    this.bgTop.style.left = "0px";
    this.bgTop.style.width = "100%";
    this.bgBottom.style.top = pos.bottom + "px";
    this.bgBottom.style.height = "100%";
    this.bgBottom.style.left = "0px";
    this.bgBottom.style.width = "100%";
    this.bgLeft.style.top = pos.top + "px";
    this.bgLeft.style.height = pos.bottom - pos.top + "px";
    this.bgLeft.style.left = "0px";
    this.bgLeft.style.width = pos.left + "px";
    this.bgRight.style.top = pos.top + "px";
    this.bgRight.style.height = pos.bottom - pos.top + "px";
    this.bgRight.style.left = pos.right + "px";
    this.bgRight.style.width = "100%";
  }

  createCropBox() {
    let movements = ["topLeft", "top", "topRight", "left", "right", "bottomLeft", "bottom", "bottomRight"];
    if (this.cropBox) {
      return;
    }
    let cropBox = document.createElement('div')
    cropBox.className = 'highlight';
    for (let name of movements) {
      let elTarget = document.createElement("div");
      elTarget.className = "mover-target direction-" + name;
      let elMover = document.createElement("div");
      elMover.className = "mover";
      elTarget.appendChild(elMover);
      cropBox.appendChild(elTarget);
    }
    this.bgTop = document.createElement("div");
    this.bgTop.className = "bghighlight";
    this.cropContainer.appendChild(this.bgTop);
    this.bgLeft = document.createElement("div");
    this.bgLeft.className = "bghighlight";
    this.cropContainer.appendChild(this.bgLeft);
    this.bgRight = document.createElement("div");
    this.bgRight.className = "bghighlight";
    this.cropContainer.appendChild(this.bgRight);
    this.bgBottom = document.createElement("div");
    this.bgBottom.className = "bghighlight";
    this.cropContainer.appendChild(this.bgBottom);
    this.cropContainer.appendChild(cropBox);
    this.cropBox = cropBox;
  }


  onClickClear() {
    this.setState({tool: this.state.tool});
    this.imageContext.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
    this.highlightContext.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
    this.canvasHeight = this.props.clip.image.dimensions.y;
    this.canvasWidth = this.props.clip.image.dimensions.x;
    this.renderImage();
    sendEvent("clear-select", "annotation-toolbar");
  }

  onClickCancel() {
    this.props.onCancelEdit(false);
    sendEvent("cancel", "annotation-toolbar");
  }

  onClickSave() {
    sendEvent("save", "annotation-toolbar");
    this.imageContext.globalCompositeOperation = 'multiply';
    this.imageContext.drawImage(this.highlighter, 0, 0);
    this.highlightContext.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
    let dataUrl = this.imageCanvas.toDataURL();
    let dimensions = {x: this.canvasWidth, y: this.canvasHeight};
    this.props.onClickSave(dataUrl, dimensions);
  }

  onClickHighlight() {
    if (this.state.tool != 'highlighter') {
      this.setState({tool: 'highlighter'});
      sendEvent("highlighter-select", "annotation-toolbar");
    }
  }

  onClickPen() {
    if (this.state.tool != 'pen') {
      this.setState({tool: 'pen'});
      sendEvent("pen-select", "annotation-toolbar");
    }
  }

  renderImage() {
    let imageContext = this.imageCanvas.getContext('2d');
    let img = new Image();
    img.crossOrigin = 'Anonymous';
    let width = this.props.clip.image.dimensions.x;
    let height = this.props.clip.image.dimensions.y;
    img.onload = () => {
      imageContext.drawImage(img, 0, 0, width, height);
    }
    this.imageContext = imageContext;
    img.src = this.props.clip.image.url;
  }

  componentDidMount() {
    this.highlightContext = this.highlighter.getContext('2d');
    this.renderImage();
    this.edit();
  }

  edit() {
    this.imageContext.drawImage(this.highlighter, 0, 0);
    this.imageContext.globalCompositeOperation = 'multiply';
    this.highlightContext.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
    if (this.state.tool != 'crop') {
      this.cropToolBar = null;
      document.removeEventListener("mousemove", this.mousemove);
      document.removeEventListener("mousedown", this.mousedown);
      document.removeEventListener("mouseup", this.mouseup);
    }
    this.pos = { x: 0, y: 0 };
    if (this.state.tool == 'highlighter') {
      this.drawContext = this.highlightContext;
      this.highlightContext.lineWidth = 20;
      this.highlightContext.strokeStyle = this.state.color;
      this.canvasContainer.addEventListener("mousemove", this.draw);
      this.canvasContainer.addEventListener("mousedown", this.setPosition);
    } else if (this.state.tool == 'pen') {
      this.drawContext = this.imageContext;
      this.imageContext.globalCompositeOperation = 'source-over';
      this.imageContext.strokeStyle = this.state.color;
      this.imageContext.lineWidth = this.state.size;
      this.canvasContainer.addEventListener("mousemove", this.draw);
      this.canvasContainer.addEventListener("mousedown", this.setPosition);
    } else if (this.state.tool == 'crop') {
      this.canvasContainer.removeEventListener("mousemove", this.draw);
      this.canvasContainer.removeEventListener("mousedown", this.setPosition);
      this.canvasContainer.removeEventListener("mouseenter", this.setPosition);
      document.addEventListener("mousemove", this.mousemove);
      document.addEventListener("mousedown", this.mousedown);
      document.addEventListener("mouseup", this.mouseup);
    }
  }

  setPosition(e) {
    let rect = this.imageCanvas.getBoundingClientRect();
    this.pos.x = e.clientX - rect.left,
    this.pos.y = e.clientY - rect.top
  }

  draw(e) {
    if (e.buttons !== 1) {
      return null;
    }
    this.drawContext.beginPath();

    this.drawContext.lineCap = this.state.tool == 'highlighter' ? 'square' : 'round';
    this.drawContext.moveTo(this.pos.x, this.pos.y);
    let rect = this.imageCanvas.getBoundingClientRect();
    this.pos.x = e.clientX - rect.left,
    this.pos.y = e.clientY - rect.top
    this.drawContext.lineTo(this.pos.x, this.pos.y);

    this.drawContext.stroke();
  }
}

class ColorPicker extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      pickerActive: false,
      color: '#000'
    };
  }

  render() {
    let border = this.state.color == 'rgb(255, 255, 255)' ? '#000' : this.state.color;
    return <div><button className="color-button" id="color-picker" onClick={this.onClickColorPicker.bind(this)} title="Color Picker" style={{"backgroundColor": this.state.color, "border": `1px solid ${border}`}}></button>
      {this.state.pickerActive ? this.renderColorBoard() : null}
    </div>
  }

  renderColorBoard() {
    return <div className="color-board">
      <div className="row">
        <div className="swatch" title="White" style={{backgroundColor: "#FFF", border: "1px solid #000"}} onClick={this.onClickSwatch.bind(this)}></div>
        <div className="swatch" title="Black" style={{backgroundColor: "#000"}} onClick={this.onClickSwatch.bind(this)}></div>
        <div className="swatch" title="Red" style={{backgroundColor: "#E74C3C"}} onClick={this.onClickSwatch.bind(this)}></div>
      </div>
        <div className="row">
        <div className="swatch" title="Green" style={{backgroundColor: "#2ECC71"}} onClick={this.onClickSwatch.bind(this)}></div>
        <div className="swatch" title="Blue" style={{backgroundColor: "#3498DB"}} onClick={this.onClickSwatch.bind(this)}></div>
        <div className="swatch" title="Yellow" style={{backgroundColor: "#FF0"}} onClick={this.onClickSwatch.bind(this)}></div>
      </div>
      <div className="row">
        <div className="swatch" title="Purple" style={{backgroundColor: "#8E44AD"}} onClick={this.onClickSwatch.bind(this)}></div>
        <div className="swatch" title="Sea Green" style={{backgroundColor: "#1ABC9C"}} onClick={this.onClickSwatch.bind(this)}></div>
        <div className="swatch" title="Grey" style={{backgroundColor: "#34495E"}} onClick={this.onClickSwatch.bind(this)}></div>
      </div>
    </div>
  }

  onClickSwatch(e) {
    let color = e.target.style.backgroundColor
    this.setState({color, pickerActive: false});
    this.props.setColor(color);
  }

  onClickColorPicker() {
    let pickerActive = !this.state.pickerActive;
    this.setState({pickerActive});
  }
}
