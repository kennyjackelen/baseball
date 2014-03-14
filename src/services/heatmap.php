<?php

  define(GAMEDAY_DB, 'gameday');
  define(PITCH_COLLECTION, 'pitches');
  define(NUM_BINS_X, 5 / (6 / 12));  // 5 feet divided into 6 inch buckets
  define(NUM_BINS_Z, 5 / (6 / 12));
  define(PX_MIN, -2.5);
  define(PX_MAX, 2.5);
  define(PZ_MIN, 0);
  define(PZ_MAX, 5);
  define(HOME_PLATE_WIDTH, 17 / 12); // 17 inches wide
  define(STRIKE_ZONE_TOP, 3.5); // 3.5 feet high
  define(STRIKE_ZONE_BOTTOM, 1.5); // 1.5 feet high

  function main()
  {
    $query = buildQueryFromInput();
    $results = queryDatabase( $query );
    buildResponse( $results, $response );
    writeResponse($response);
  }

  function buildQueryFromInput()
  {
    $fileContents = file_get_contents( 'php://input' );
    $request = json_decode( $fileContents );
    $query = array(
      'balls' => (int)$request->balls,
      'strikes' => (int)$request->strikes,
      'p_throws' => $request->p_throws,
      'stand' => $request->b_bats );
    return $query;
  }

  function queryDatabase( $query )
  {  
    $m = new MongoClient();
    $pitches = $m->selectCollection( GAMEDAY_DB, PITCH_COLLECTION );
    $fields = array( 'px' => true, 'pz' => true );
    return $pitches->find($query, $fields);
  }

  function buildResponse( $results, &$response )
  {
    $heatmap = binResults( $results );
    calculateMaxMin( $heatmap, $max, $min );
    $strikezone = calculateStrikeZone();
    $response = array(
      'heatmap' => $heatmap,
      'strikezone' => $strikezone,
      'max' => $max,
      'min' => $min );
  } 

  function binResults( $results )
  {
    $heatmap = initializeHeatmap();
    foreach ($results as $pitch)
    {
      try
      {
        $xbin = GetHorizontalBin( $pitch['px'] );
        $zbin = GetVerticalBin( $pitch['pz'] );
        $heatmap[ (int)$xbin ][ (int)$zbin ]++;
      }
      catch (Exception $e)
      {
        continue;
      }
    }
    return $heatmap;
  }

  function initializeHeatmap()
  {
    $heatmap = array();
    for ($i=0; $i<NUM_BINS_X; $i++)
    {
      $heatmap[] = array();
      for ($j=0; $j<NUM_BINS_Z; $j++)
      {
        $heatmap[$i][] = 0;
      }
    }
    return $heatmap;
  }

  function calculateMaxMin( $heatmap, &$max, &$min )
  {
    $min = INF;
    $max = 0;
    for ($i=0; $i<NUM_BINS_X; $i++)
    {
      for ($j=0; $j<NUM_BINS_Z; $j++)
      {
        $value = $heatmap[$i][$j];
        if ($value > $max) {
          $max = $value;
        }
        if ($value > 0 and $value < $min) {
          $min = $value;
        }
      }
    }
  }

  function calculateStrikeZone()
  {
    $bin_size_x = ( PX_MAX - PX_MIN ) / NUM_BINS_X;
    $bin_size_z = ( PZ_MAX - PZ_MIN ) / NUM_BINS_Z;
    $strike_zone['top'] = ( PZ_MAX - STRIKE_ZONE_TOP ) / $bin_size_z;
    $strike_zone['bottom'] = ( PZ_MAX - STRIKE_ZONE_BOTTOM ) / $bin_size_z;
    $strike_zone['left'] = ( -0.5 * HOME_PLATE_WIDTH - PX_MIN ) / $bin_size_x;
    $strike_zone['right'] = ( 0.5 * HOME_PLATE_WIDTH - PX_MIN ) / $bin_size_x;
    return $strike_zone;
  }

  function writeResponse( $response )
  {
    header( 'Content-type: application/json' );
    echo json_encode( $response );
  }

  function GetHorizontalBin($px)
  {
    if ($px < PX_MIN || $px >= PX_MAX)
    {
      throw new Exception('x coordinate out of bounds');
    }
    $bin_size = ( PX_MAX - PX_MIN ) / NUM_BINS_X;
    return floor( ( $px - PX_MIN ) / $bin_size );
  }

  function GetVerticalBin($pz)
  {
    if ($pz <= PZ_MIN || $pz > PZ_MAX)
    {
      throw new Exception('z coordinate out of bounds');
    }
    $bin_size = ( PZ_MAX - PZ_MIN ) / NUM_BINS_Z;
    return floor( ( PZ_MAX - $pz ) / $bin_size );
  }

  main();

?>