;(function( global ) {

  if ( global.heatmap !== undefined ) {
    throw 'heatmap is already defined!';
  }

  var heatmap = function heatmap$constructor( hostEl, request ) {
    // initialize the object
    if ( hostEl === undefined ) {
      throw 'heatmap.js: No host element supplied!';
    }
    this._request = request;
    this._hostEl = hostEl;
    this._initColors();
  };

  heatmap.prototype = {

    // constants
    RBG_MAX_VAL: 255,
    BLUE_VAL: 0.5,
    RED_VAL: 12,
    VIEWBOX_SIZE: 100,

    _hostEl: null,
    _request: {},

    _colorThresholds: {},

    // server response object containing data to display
    // in the heatmap
    _heatmapData: {},

    load: function heatmap$load() {
      // communicate with server to get heatmap data
      var xhr,
        heatmapObject;

      heatmapObject = this;

      xhr = new XMLHttpRequest();
      xhr.open( 'POST', '/baseball/services/heatmap.php', true );
      xhr.onload = function heatmap$_loadCallback() {
        heatmapObject._processHeatmapData( this );
      };
      xhr.setRequestHeader( 'Content-Type', 'application/json; charset=UTF-8' );
      xhr.send( JSON.stringify( this._request ) );
    },

    _display: function heatmap$display() {
      // show heatmap within the supplied element
      var svgEl;

      this._hostEl.innerHTML = '';
      svgEl = this._buildSVGEl( this._hostEl );
      this._drawHeatmapBlocks( svgEl );
      this._drawStrikezone( svgEl );
    },

    _initColors: function heatmap$_initColors() {
      var interval;

      interval = ( this.RED_VAL - this.BLUE_VAL ) / 4;
      this._colorThresholds = {
        BLUE: this.BLUE_VAL,
        CYAN: this.BLUE_VAL + interval,
        GREEN: this.BLUE_VAL + 2 * interval,
        YELLOW: this.BLUE_VAL + 3 * interval,
        RED: this.RED_VAL
      };
    },

    _drawHeatmapBlocks: function heatmap$_drawHeatmapBlocks( svgEl ) {
      var size,
        row,
        col,
        fillColor,
        rectEl,
        rectSize;

      size = this._heatmapData.heatmap.length;
      rectSize = this.VIEWBOX_SIZE / size;

      for ( row = 0; row < size; row++ ) {
        for ( col = 0; col < size; col++ ) {
          fillColor = this._getFillColor( row, col );
          if ( fillColor.length === 0 ) {
            // cell didn't register on the heatmap, don't draw a block
            continue;
          }
          rectEl = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' );
          rectEl.setAttribute( 'x', row * rectSize );
          rectEl.setAttribute( 'y', col * rectSize );
          rectEl.setAttribute( 'width', rectSize );
          rectEl.setAttribute( 'height', rectSize );
          rectEl.setAttribute( 'data-zscore', this._heatmapData.heatmap[ row ][ col ] );
          rectEl.setAttribute( 'style', 'fill: ' + fillColor );
          svgEl.appendChild( rectEl );
        }
      }
    },

    _drawStrikezone: function heatmap$_drawStrikezone( svgEl ) {
      var rectEl,
        size,
        rectSize,
        top,
        left,
        height,
        width;
      
      size = this._heatmapData.heatmap.length;
      rectSize = this.VIEWBOX_SIZE / size;

      top = this._heatmapData.zone_top * rectSize;
      left = this._heatmapData.zone_left * rectSize;
      width = ( this._heatmapData.zone_right - this._heatmapData.zone_left ) * rectSize;
      height = ( this._heatmapData.zone_bottom - this._heatmapData.zone_top ) * rectSize;
      
      rectEl = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
      rectEl.setAttribute( 'x', left );
      rectEl.setAttribute( 'y', top );
      rectEl.setAttribute( 'width', width );
      rectEl.setAttribute( 'height', height );
      rectEl.setAttribute( 'style', 'fill: none; stroke:rgb(80,80,80);stroke-width:1');
      svgEl.appendChild( rectEl );
    },

    _getFillColor: function heatmap$_getFillColor( row, col ) {
      var cellVal,
        minVal,
        r,
        g,
        b,
        threshold,
        size;

      size = this._heatmapData.heatmap.length;
      expVal = this._heatmapData.n_pitches / Math.pow(size,2);
      cellVal = this._heatmapData.heatmap[ row ][ col ] / expVal;
      //cellVal = this._heatmapData.heatmap[ row ][ col ];
      minVal = 0;
      //minVal = this._heatmapData.minHeatmapVal;
      threshold = this._colorThresholds;

      r = 0;
      g = 0;
      b = 0;
      if ( cellVal <= minVal ) {
        return '';
      } else if ( cellVal < threshold.BLUE ) {
        // gradient from black to blue
        b = this._getColorValue( cellVal, minVal, threshold.BLUE );
      } else if ( cellVal < threshold.CYAN ) {
        // gradient from blue to cyan
        g = this._getColorValue( cellVal, threshold.BLUE, threshold.CYAN );
        b = 255;
      } else if ( cellVal < threshold.GREEN ) {
        // gradient from cyan to 
        g = 255;
        b = 255 - this._getColorValue( cellVal, threshold.CYAN, threshold.GREEN );
      } else if ( cellVal < threshold.YELLOW ) {
        // gradient from green to yellow
        r = this._getColorValue( cellVal, threshold.GREEN, threshold.YELLOW );
        g = 255;
      } else if ( cellVal < threshold.RED ) {
        // gradient from yellow to red
        r = 255;
        g = 255 - this._getColorValue( cellVal, threshold.YELLOW, threshold.RED );
      } else {
        // everything above this is pure red
        r = 255;
      }

      return 'rgb(' + r + ',' + g + ',' + b + ')';
    },

    _getColorValue: function heatmap$_getColorValue( value, minVal, maxVal ) {
      var distanceFromBottom,
        range;

      distanceFromBottom = value - minVal;
      range = maxVal - minVal;

      // use Math.floor here because RGB values must be integers
      return Math.floor( this.RBG_MAX_VAL * distanceFromBottom / range );

    },

    _processHeatmapData: function heatmap$_processHeatmapData( xhr ) {
      this._heatmapData = JSON.parse(xhr.responseText);
      this._display();
    },

    _buildSVGEl: function heatmap$_buildSVGEl( hostEl ) {
      var svgEl;

      svgEl = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
      svgEl.setAttributeNS( null, 'viewBox', '0 0 100 100' );
      hostEl.appendChild( svgEl );

      return svgEl;
    }
    
  };

  global.heatmap = heatmap;

})( this );