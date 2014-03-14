;(function( global ) {  // jshint ignore:line

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
  };

  heatmap.prototype = {

    // constants
    RBG_MAX_VAL: 255,
    BLUE_VAL: 0.0040,
    RED_VAL: 0.0067,
    VIEWBOX_SIZE: 100,

    _hostEl: null,
    _request: {},

    _colorThresholds: {},
    unused: 0,
    _rectSize: 0,  // in viewbox units

    // server response object containing data to display
    // in the heatmap
    _heatmapData: {},

    /*global XMLHttpRequest */
    load: function heatmap$load( callback ) {
      // communicate with server to get heatmap data
      var xhr,
        heatmapObject;

      heatmapObject = this;

      xhr = new XMLHttpRequest();
      xhr.open( 'POST', '/baseball/services/heatmap.php', true );
      xhr.onload = function heatmap$_loadCallback() {
        heatmapObject._processHeatmapData( this );
        callback();
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
      var interval,
        min,
        max;

      min = this._heatmapData.min;
      max = this._heatmapData.max;

      interval = ( max - min ) / 10;
      this._colorThresholds = {
        BLACK: min,
        BLUE: min + 3 * interval,
        CYAN: min + 4 * interval,
        GREEN: min + 5 * interval,
        YELLOW: min + 6 * interval,
        RED: max
      };
    },

    /*global document */
    _drawHeatmapBlocks: function heatmap$_drawHeatmapBlocks( svgEl ) {
      var row,
        col,
        fillColor,
        circleEl;

      for ( row = 0; row < this._size; row++ ) {
        for ( col = 0; col < this._size; col++ ) {
          fillColor = this._getFillColor( row, col );
          if ( fillColor.length === 0 ) {
            // cell didn't register on the heatmap, don't draw a block
            continue;
          }
          circleEl = document.createElementNS( 'http://www.w3.org/2000/svg', 'circle' );
          circleEl.setAttribute( 'cx', row * this._rectSize + 0.5 * this._rectSize );
          circleEl.setAttribute( 'cy', col * this._rectSize + 0.5 * this._rectSize );
          circleEl.setAttribute( 'r', this._rectSize );
          circleEl.setAttribute( 'data-zscore', this._heatmapData.heatmap[ row ][ col ] );
          circleEl.setAttribute( 'filter', 'url(#heatmapBlur)' );
          circleEl.setAttribute( 'style', 'fill: ' + fillColor );
          svgEl.appendChild( circleEl );
        }
      }
    },

    /*global document */
    _drawStrikezone: function heatmap$_drawStrikezone( svgEl ) {
      var rectEl,
        top,
        left,
        height,
        width,
        zone;
      
      zone = this._heatmapData.strikezone;

      top = zone.top * this._rectSize;
      left = zone.left * this._rectSize;
      width = ( zone.right - zone.left ) * this._rectSize;
      height = ( zone.bottom - zone.top ) * this._rectSize;
      
      rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rectEl.setAttribute( 'x', left );
      rectEl.setAttribute( 'y', top );
      rectEl.setAttribute( 'width', width );
      rectEl.setAttribute( 'height', height );
      rectEl.setAttribute( 'style', 'fill: none; stroke:rgb(80,80,80); stroke-width:1');
      svgEl.appendChild( rectEl );
    },

    _getFillColor: function heatmap$_getFillColor( row, col ) {
      var cellVal,
        r,
        g,
        b,
        threshold;

      cellVal = this._heatmapData.heatmap[ row ][ col ];
      threshold = this._colorThresholds;

      r = 0;
      g = 0;
      b = 0;
      if ( cellVal <= threshold.BLACK ) {
        return '';
      } else if ( cellVal < threshold.BLUE ) {
        // gradient from black to blue
        b = this._getColorValue( cellVal, threshold.BLACK, threshold.BLUE );
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
      this._size = this._heatmapData.heatmap.length;
      this._rectSize = this.VIEWBOX_SIZE / this._size;
      this._initColors();
      this._display();
    },

    _buildSVGEl: function heatmap$_buildSVGEl( hostEl ) {
      var svgEl,
        defsEl,
        filterEl,
        blurEl;

      svgEl = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
      svgEl.setAttributeNS( null, 'viewBox', '0 0 ' + this.VIEWBOX_SIZE + ' ' + this.VIEWBOX_SIZE );

      defsEl = document.createElementNS( 'http://www.w3.org/2000/svg', 'defs' );
      filterEl = document.createElementNS( 'http://www.w3.org/2000/svg', 'filter' );
      filterEl.setAttributeNS( null, 'x', '-500%' );
      filterEl.setAttributeNS( null, 'y', '-500%' );
      filterEl.setAttributeNS( null, 'width', '1000%' );
      filterEl.setAttributeNS( null, 'height', '1000%' );
      filterEl.setAttributeNS( null, 'id', 'heatmapBlur' );
      blurEl = document.createElementNS( 'http://www.w3.org/2000/svg', 'feGaussianBlur' );
      blurEl.setAttributeNS( null, 'in', 'SourceGraphic' );
      blurEl.setAttributeNS( null, 'stdDeviation', '5');

      filterEl.appendChild( blurEl );
      defsEl.appendChild( filterEl );
      svgEl.appendChild( defsEl );
      hostEl.appendChild( svgEl );
      return svgEl;
    }
    
  };

  global.heatmap = heatmap;

})( this );