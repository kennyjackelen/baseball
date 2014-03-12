<?php

  //keep it stupid
  define(NUM_BINS_X, 28);
  define(NUM_BINS_Z, 28);
  define(PX_MIN, -3.5);
  define(PX_MAX, 3.5);
  define(PZ_MIN, 0);
  define(PZ_MAX, 7);

  header('Content-type: application/json');
  # get inputs
  $request = json_decode(file_get_contents('php://input'));
  $balls = $request->balls;
  $strikes = $request->strikes;
  $b_bats = $request->b_bats;
  $p_throws = $request->p_throws;
  $method = $request->method;

  $response = array();
  $bin_size_x = ( PX_MAX - PX_MIN ) / NUM_BINS_X;
  $bin_size_z = ( PZ_MAX - PZ_MIN ) / NUM_BINS_Z;
  # home plate is 17 inches wide
  $response['zone_left'] = ( (-8.5 / 12) - PX_MIN ) / $bin_size_x;
  $response['zone_right'] = ( (8.5 / 12) - PX_MIN ) / $bin_size_x;
  # use 1.5 feet for bottom of zone, 3.5 feet for top
  $response['zone_top'] = ( PZ_MAX - 3.5 ) / $bin_size_z;
  $response['zone_bottom'] = ( PZ_MAX - 1.5 ) / $bin_size_z;

  $rawBinCounts = array();
  $collectionOfBinCounts = array();
  $m = new MongoClient();
  $db = $m->gameday;
  $pitches = $db->pitches;

  $query = array('balls' => $balls, 'strikes' => $strikes, 'p_throws' => $p_throws, 'stand' => $b_bats);
  #$query = array('balls' => 0, 'strikes' => 2, 'p_throws' => 'L', 'stand' => 'L');
  $fields = array('px' => true, 'pz' => true);
  $results = $pitches->find($query, $fields);
  $count = 0;

  $newheatmap = array();
  for ($i=0; $i<NUM_BINS_X; $i++)
  {
    $newheatmap[] = array();
    for ($j=0; $j<NUM_BINS_Z; $j++)
    {
      $newheatmap[$i][] = 0;
    }
  }

  foreach ($results as $pitch)
  {
    try
    {
      $xbin = GetHorizontalBin( $pitch['px'] );
      $zbin = GetVerticalBin( $pitch['pz'] );
      //$rawBinCounts[$xbin][$zbin]++;
      if ($count % 5 == 1) {
        $newheatmap[(int)$xbin][(int)$zbin]++;
      }
      $count++;
    }
    catch (Exception $e)
    {
      continue;
    }
  }
/*
  foreach ($rawBinCounts as $colNum => $cells)
  {
    foreach ($cells as $rowNum => $count)
    {
      if ($count > 0)
      {
        $collectionOfBinCounts[] = $count;
      }
    }
  }

  $xbar = array_sum($collectionOfBinCounts) / count($collectionOfBinCounts);
  $stdev = stats_standard_deviation($collectionOfBinCounts);
  $min = min($collectionOfBinCounts);
  $max = max($collectionOfBinCounts);

  $heatmap = array();
  $heatmap_min_val = 10000;
  $heatmap_max_val = -10000;

  for ($i=0; $i<NUM_BINS_X; $i++)
  {
    $heatmap[] = array();
    for ($j=0; $j<NUM_BINS_Z; $j++)
    {
      //$heatmap[$i][] = stats_cdf_normal(($rawBinCounts[(string)$i][(string)$j] - $xbar) / $stdev, 0, 1, 1);
      $heatmap[$i][] = ( $rawBinCounts[(string)$i][(string)$j] - $min ) / ( $max - $min);
      if ($heatmap[$i][$j] > $heatmap_max_val)
      {
        $heatmap_max_val = $heatmap[$i][$j];
      }
      if ($heatmap[$i][$j] < $heatmap_min_val)
      {
        $heatmap_min_val = $heatmap[$i][$j];
      }
    }
  }
*/
  $response['heatmap'] = $newheatmap;
  $response['n_pitches'] = $count / 5;
  //$response['minHeatmapVal'] = $heatmap_min_val;
  //$response['maxHeatmapVal'] = $heatmap_max_val;

  echo json_encode( $response );

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

?>