// In short: fetches data from google API, show on dashboard
// you need to authenticate in your local JS

// various reusable icons
var iconWarning = '<span class="icon icon-generic is-invalid-label" data-icon="l">  </span>';


// extract the pub date from the url
function parsePublicationDate(url) {
  var yearMonth = url.split('/')[2].substring(0,4);
      yearMonth = '20' + yearMonth;
  var year = yearMonth.slice(0,-2);
  var month = yearMonth.slice(-2);
  return month + '/' + year;
}

// == NOTE ==
// This code uses ES6 promises. If you want to use this code in a browser
// that doesn't supporting promises natively, you'll have to include a polyfill.
function analyticsAuthorize(clientid) {
  // Authorize the user immediately if the user has already granted access.
  // If no access has been created, render an authorize button inside the
  // element with the ID "embed-api-auth-container".
  gapi.analytics.auth.authorize({
    container: 'embed-api-auth-container',
    clientid: clientid
  });
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// check if the request has expired (that is: the user changed the params)
function requestIsExpired(requestDate) {
  console.log(moment(requestDate).format('YYYY-MM-DD'),document.getElementById("originDate").value);
  if (moment(requestDate).format('YYYY-MM-DD') != document.getElementById("originDate").value) {
    console.log('expired');
    return true; // if the dates are out of sync, request has expired
  }
  return false; // request is still valid
}

var render_queue_time = 1;
// Queue up the requests to not exceed GA's requests per second (10 per second, per IP), 50,000 a day
// https://developers.google.com/analytics/devguides/config/mgmt/v3/limits-quotas#general_api
function render_queue(target,processor,dimensions,metrics,filters,shared) {
  render_queue_time = render_queue_time + 500; // set requests XXms second apart

  if (processor == "traffic-overview") {
    window.setTimeout(function(){
      render_query_traffic_overview(target,dimensions,metrics,filters,shared);
      },render_queue_time);
  }

  if (processor == "overview-list") {
    window.setTimeout(function(){
      render_query_overview(target,dimensions,metrics,filters,shared);
      },render_queue_time);
  }
  if (processor == "page-detail") {
    window.setTimeout(function(){
      render_query_page_detail(target,dimensions,metrics,filters,shared);
      },render_queue_time);
  }
  if (processor == "ui-regions") {
    window.setTimeout(function(){
      render_query_ui_regions(target,dimensions,metrics,filters,shared);
      },render_queue_time);
  }
  if (processor == "page-time") {
    window.setTimeout(function(){
      render_query_page_time(target,dimensions,metrics,filters,shared);
      },render_queue_time);
  }
  if (processor == "leave-rate") {
    window.setTimeout(function(){
      render_query_leave_rate(target,dimensions,metrics,filters,shared);
      },render_queue_time);
  }
}

function render_query_traffic_overview(target,dimensions,metrics,filters,shared) {
  $('#table-header').html('Top stories from the past ' + (shared['dayRange']-1) + ' days');

  var now = shared['originDate']; // .subtract(3, 'day');
  var week1 = query({
    'ids': shared['viewID'],
    'dimensions': dimensions,
    'metrics': metrics,
    'filters': filters,
    'max-results': shared['dayRange'],
    // 'sort': '-'+metrics,
    'start-date': moment(now).subtract(shared['dayRange'], 'day').format('YYYY-MM-DD'),
    'end-date': moment(now).subtract(1, 'day').format('YYYY-MM-DD')
  });

  var week2 = query({
    'ids': shared['viewID'],
    'dimensions': dimensions,
    'metrics': metrics,
    'filters': filters,
    'max-results': shared['dayRange'],
    // 'sort': '-'+metrics,
    'start-date': moment(now).subtract(shared['dayRange']*2, 'day').format('YYYY-MM-DD'),
    'end-date': moment(now).subtract(shared['dayRange'], 'day').format('YYYY-MM-DD')
  });


  Promise.all([week1,week2]).then(function(results) {

    // console.log(results);

    var labels = new Array();

    for (var i = 0; i < results[0].rows.length; i++) {
      labels.push(results[0].rows[i]);
    }

    // var labels = [results[0].rows[0],'Feb','Mar','Apr','May','Jun'];

    labels = labels.map(function(label) {
      return moment(label, 'YYYYMMDD').format('MMM D (ddd)');
    });

    var data1 = results[0].rows.map(function(row) { return +row[2]; });
    var data2 = results[1].rows.map(function(row) { return +row[2]; });


    var data = {
      labels : labels,
      datasets : [
        {
          label: 'This weeks\'s page views of all articles',
          fillColor : 'rgba(120,220,220,0.15)',
          strokeColor : 'rgba(120,220,220,1)',
          pointColor : 'rgba(120,220,220,1)',
          pointStrokeColor : '#fff',
          data : data1
        },
        {
          label: 'Last week',
          fillColor : 'rgba(220,220,220,0.35)',
          strokeColor : 'rgba(220,220,220,1)',
          pointColor : 'rgba(220,220,220,1)',
          pointStrokeColor : '#fff',
          data : data2
        },
      ]
    };

    new Chart(makeCanvas('chart-1-container')).Line(data);
    generateLegend('legend-1-container', data.datasets);
    // $('#chart-1-container').prepend('<div class="label">text</div>');

  });

}

function render_query_overview(target,dimensions,metrics,filters,shared) {
  if (requestIsExpired(shared['originDate'])) { return; }
  var now = shared['originDate']; // .subtract(3, 'day');
  var localQuery = query({
    'ids': shared['viewID'],
    'dimensions': dimensions,
    'metrics': metrics,
    'filters': filters,
    'max-results': 8,
    'sort': '-'+metrics,
    'start-date': moment(now).subtract(shared['dayRange'], 'day').format('YYYY-MM-DD'),
    'end-date': moment(now).subtract(1, 'day').format('YYYY-MM-DD')
  });

  Promise.all([localQuery]).then(function(results) {
    $('h2.local-title').html('This period vs last');
    $('.local-description').html('' + results[0].query['start-date'] + ' to ' + results[0].query['end-date'] + '');

    // once we know the top stories, perform queries about them
    var receivedData = results[0].rows;
    for (var i = 0; i < receivedData.length; i++) {
      // save the total number of page views
      shared['urlPageViews'] = receivedData[i][2];
      var success = '';
      if (shared['urlPageViews'] < 250) {
        success = iconWarning;
      }


      $(target).append('<tr class="result-'+ i + '">' + 
        '<td>' + 
        '<span class="label">' + parsePublicationDate(receivedData[i][1]) + '</span>' +
        '<div>' + receivedData[i][0] + '</div>' +
        '<small><a target="_blank" href="http://news.embl.de' + receivedData[i][1] + '">'+ receivedData[i][1]+'</a></small></td>' +
        '<td>' + shared['urlPageViews'] + success + '</td><td class="tr-referals small"></td><td class="tr-ui-regions"></td><td class="tr-time-on-page"></td><td class="tr-leave-rate"></td></tr>');      

    
      render_queue('tr.result-'+i,'page-detail','ga:fullReferrer','ga:uniquePageviews',
        'ga:pagePath=='+receivedData[i][1],shared);

      render_queue('tr.result-'+i,'ui-regions','ga:eventAction','ga:uniqueEvents',
        'ga:pagePath=='+receivedData[i][1],shared);

      render_queue('tr.result-'+i,'page-time','ga:pagePath','ga:avgTimeOnPage',
        'ga:pagePath=='+receivedData[i][1],shared);

      render_queue('tr.result-'+i,'leave-rate','ga:pagePath','ga:bounceRate',
        'ga:pagePath=='+receivedData[i][1],shared);
    }

  });

}

// convert facebook.com/ to Facebook, etc.
function parseReferralName(siteToParse) {
  var original =     ['facebook','t.co',   'google','pinterest','linkedin','ebi.ac','rssfeed','direct']
  var replacements = ['Facebook','Twitter','Google','Pinterest','LinkedIn','EBI',   'RSS',    'Not specificed or bookmark']

  for (var i = 0; i < original.length; i++) {
    if (siteToParse.indexOf(original[i]) >= 0) {
      return replacements[i];
    }
  }

  // no match, return what it was:
  return siteToParse;
}

function render_query_page_detail(target,dimensions,metrics,filters,shared) {
  if (requestIsExpired(shared['originDate'])) { return; }
  var now = shared['originDate']; // .subtract(3, 'day');
  var localQuery = query({
    'ids': shared['viewID'],
    'dimensions': dimensions,
    'metrics': metrics,
    'filters': filters,
    'max-results': 7,
    'sort': '-'+metrics,
    'start-date': moment(now).subtract(shared['dayRange'], 'day').format('YYYY-MM-DD'),
    'end-date': moment(now).subtract(1, 'day').format('YYYY-MM-DD')
  });

  Promise.all([localQuery]).then(function(results) {
    var receivedData = results[0].rows;
    // $(target).append('<td class=""></td>');
    
    for (var i = 0; i < receivedData.length; i++) {
      $(target+' td.tr-referals').append('<tr><td>' + parseReferralName(receivedData[i][0]) +'</td><td>' + receivedData[i][1] + '</td></tr>');
    }
  });
}

function render_query_ui_regions(target,dimensions,metrics,filters,shared) {
  if (requestIsExpired(shared['originDate'])) { return; }
  var now = shared['originDate']; // .subtract(3, 'day');
  var localQuery = query({
    'ids': shared['viewID'],
    'dimensions': dimensions,
    'metrics': metrics,
    'filters': filters,
    'max-results': 12,
    'sort': '-'+metrics,
    'start-date': moment(now).subtract(shared['dayRange'], 'day').format('YYYY-MM-DD'),
    'end-date': moment(now).subtract(1, 'day').format('YYYY-MM-DD')
  });

  Promise.all([localQuery]).then(function(results) {
    var receivedData = results[0].rows;
    // console.table(results);
    // $(target).append('<td class=""></td>');

    // track where users engaged
    var totalContentClicks = 0;
    var totalSiteNavClicks = 0;
    
    for (var i = 0; i < receivedData.length; i++) {
      // is it a UI region?
      if (receivedData[i][0].indexOf('UI Element') >= 0) {
        // $(target+' td.tr-ui-regions').append('<tr><td>' + receivedData[i][0] +'</td><td>' + receivedData[i][1] + '</td></tr>');

        if (receivedData[i][0].indexOf('UI Element / Content') >= 0) {
          totalContentClicks++;
        } else {
          totalSiteNavClicks++;
        }
      }
    }

    var engagementPercent = (Math.floor(totalContentClicks / (totalContentClicks+shared['urlPageViews']) * 1000)) / 10; // the number of unique content clicks vs unique page views

    // read out the sums
    // $(target+' td.tr-ui-regions').append('<tr><td>Total clicks</td><td>' + (totalSiteNavClicks + totalContentClicks) + '</td></tr>');
    // $(target+' td.tr-ui-regions').append('<tr><td>Content click ratio</td><td>' + Math.floor(totalContentClicks  / (totalSiteNavClicks + totalContentClicks) * 100 ) + '%</td></tr>');
    $(target + ' td.tr-ui-regions').append('' + totalContentClicks + ' (' + engagementPercent + '%) <br/>');
    if (engagementPercent < 2) {
      $(target + ' td.tr-ui-regions').append(iconWarning);
    }
    // $(target + ' td.tr-ui-regions').append('Engagement %: ' + + '<br/>');
  });
}

function render_query_page_time(target,dimensions,metrics,filters,shared) {
  if (requestIsExpired(shared['originDate'])) { return; }
  var now = shared['originDate']; // .subtract(3, 'day');
  var localQuery = query({
    'ids': shared['viewID'],
    'dimensions': dimensions,
    'metrics': metrics,
    'filters': filters,
    'max-results': 1,
    'sort': '-'+metrics,
    'start-date': moment(now).subtract(shared['dayRange'], 'day').format('YYYY-MM-DD'),
    'end-date': moment(now).subtract(1, 'day').format('YYYY-MM-DD')
  });

  Promise.all([localQuery]).then(function(results) {
    var receivedData = results[0].rows;
    var timeOnPage = Math.round((receivedData[0][1] / 60) * 100) / 100;
    $(target + ' td.tr-time-on-page').append('' + timeOnPage );
  });
}

function render_query_leave_rate(target,dimensions,metrics,filters,shared) {
  if (requestIsExpired(shared['originDate'])) { return; }
  var now = shared['originDate']; // .subtract(3, 'day');
  var localQuery = query({
    'ids': shared['viewID'],
    'dimensions': dimensions,
    'metrics': metrics,
    'filters': filters,
    'max-results': 1,
    'sort': '-'+metrics,
    'start-date': moment(now).subtract(shared['dayRange'], 'day').format('YYYY-MM-DD'),
    'end-date': moment(now).subtract(1, 'day').format('YYYY-MM-DD')
  });

  Promise.all([localQuery]).then(function(results) {
    console.table(results[0].rows);

    var receivedData = results[0].rows;
    var leaveRate = Math.round((receivedData[0][1]) * 100) / 100;
    $(target + ' td.tr-leave-rate').append('' + leaveRate +'% ');

    // update table sorting
    $("#table-report").trigger('update');

    // add pie graph
    var uniqueID = Math.floor(Math.random() * 7);
    $(target + ' td.tr-leave-rate').prepend('<div id="leave-container-'+uniqueID+'"></div>');
    var labels = new Array();

    var data = [];
    var colors = ['rgb(218,15,33)','rgb(109,171,73)','#D4CCC5','#E2EAE9','#F7464A'];

    // add the negative non 100% portion
    data.push({
      label: results[0].rows[0][1],
      value: +(1-(results[0].rows[0][1]/100)),
      color: colors[1]
    });

    results[0].rows.forEach(function(row, i) {
      data.push({
        label: row[0],
        value: +row[1]/100,
        color: colors[i]
      });
    });

    new Chart(makeCanvas('leave-container-'+uniqueID)).Pie(data);
  });


}

/**
 * Extend the Embed APIs `gapi.analytics.report.Data` component to
 * return a promise the is fulfilled with the value returned by the API.
 * @param {Object} params The request parameters.
 * @return {Promise} A promise.
 */
function query(params) {
  return new Promise(function(resolve, reject) {
    var data = new gapi.analytics.report.Data({query: params});
    data.once('success', function(response) { resolve(response); })
        .once('error', function(response) { reject(response); })
        .execute();
  });
}
