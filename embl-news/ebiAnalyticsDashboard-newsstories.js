// In short: fetches data from google API, show on dashboard
// you need to authenticate in your local JS

// Custom utility functions specific to this dahsboard
// --------
// Extract the pub date from the url
function parsePublicationDate(url) {
  var yearMonth = url.split('/')[2].substring(0,4);
      yearMonth = '20' + yearMonth;
  var year = yearMonth.slice(0,-2);
  var month = yearMonth.slice(-2);
  return month + '/' + year;
}

// shared paramaters for all charts
// --------
var shared = [];
shared['filters'] = 'ga:pagePath!=/index.php;ga:pagePath!@/category/';
shared['datePeriods'] = ['day','month','year'];
shared['dayRange'] = 8; // the number of days you wish to get results for. Make this value +1 (1 week = 8 days, 2 wks = 15 days)
shared['viewID'] = ['ga:91186979'];  //The GA property we want to view: www.ebi.ac.uk
shared['clientid'] = '1025857412047-p3jieogi7mgkhb0dre41rm2ge3r8jn0s.apps.googleusercontent.com'; // get at https://console.developers.google.com/apis/credentials

// Allow the user to change the query (date)
// --------
function enableUserDatePicking() {
  // set a default date
  document.getElementById("originDate").value = moment().format('YYYY-MM-DD');

  // update the report on date change
  function userChangedDate() {
    console.log('Change requested, refreshing...');
    render_queue_time = 1; // reset the processing throttle
    $('tbody.top-stories').html(''); // empty the results
    var requestDate = moment(document.getElementById("originDate").value, 'YYYY-MM-DD');
    bootstrapCustomEBIAnalytics(requestDate);
  }

  // delay the invokation of the date change to not hammer the GAPI
  var userChangedDateTimeoutID;
  $('#originDate').change( function () {
    window.clearTimeout(userChangedDateTimeoutID); // delete any pending change that occured before the timeout cleared
    userChangedDateTimeoutID = window.setTimeout(userChangedDate, 750);
  });
}

// Initialise all the queries.
// This gets invoke when google is ready and when the user calls a refresh by selecting a date
// requestedOriginDate = YYYYMMDD format, ie: 20170122
function bootstrapCustomEBIAnalytics(requestedOriginDate) {

  shared['originDate'] = moment(requestedOriginDate, "YYYYMMDD"); // we allow user to specify an origin date
  analyticsAuthorize(shared['clientid']);

  // Render traffic overview graph
  render_queue('traffic-overview',0);

  // Render all the of charts for this view.
  render_queue('overview-list',0);

  // $("#table-report").tablesorter();
}

// Bootstrap
// --------
$(document).ready(function() {

  // when the GAPI is ready, run the process
  gapi.analytics.ready(function() {
    var defaultDateNow = moment().format('YYYYMMDD');
    bootstrapCustomEBIAnalytics(defaultDateNow);
    enableUserDatePicking();
  });

});


// Queue up the requests to not exceed GA's requests per second (10 per second, per IP), 50,000 a day
// --------
// https://developers.google.com/analytics/devguides/config/mgmt/v3/limits-quotas#general_api
// We pass in:
//  - processor = task to be scheduled
//  - row = result row to work; 0 = global
var render_queue_time = 1;
function render_queue(processor,row) {
  render_queue_time += 500; // set requests XXms second apart

  window.setTimeout(function(){
    switch (processor) {
      case 'traffic-overview':
        fetch_traffic_overview('.traffic-overview','ga:date,ga:nthDay','ga:uniquePageviews',
          shared['filters']+'',shared,row);
        break;
      case 'overview-list':
        fetch_overview('.top-stories','ga:pageTitle,ga:pagePath','ga:uniquePageviews',
          shared['filters']+'',shared,row);
        break;
      case 'page-detail':
        fetch_page_detail('tr.result-'+row,'ga:fullReferrer','ga:uniquePageviews',
          'ga:pagePath=='+analyticsResults[row].url,shared,row);
        break;
      case 'ui-regions':
        fetch_ui_regions('tr.result-'+row,'ga:eventAction','ga:uniqueEvents',
          'ga:pagePath=='+analyticsResults[row].url,shared,row);
        break;
      case 'page-time':
        fetch_page_time('tr.result-'+row,'ga:pagePath','ga:avgTimeOnPage',
          'ga:pagePath=='+analyticsResults[row].url,shared,row);
      case 'leave-rate':
        fetch_leave_rate('tr.result-'+row,'ga:pagePath','ga:bounceRate',
          'ga:pagePath=='+analyticsResults[row].url,shared,row);
        break;
      default:
        console.log('Unexpected queue task: ' + processor);
    }
  },render_queue_time);
}

// From here down we fetch and render data
// --------
function fetch_traffic_overview(target,dimensions,metrics,filters,shared) {
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
    setChartDefaults();
    generateLegend('legend-1-container', data.datasets);
    // $('#chart-1-container').prepend('<div class="label">text</div>');

  });

}

function fetch_overview(target,dimensions,metrics,filters,shared) {
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
    for (var row = 0; row < receivedData.length; row++) {
      // write to the saved object
      analyticsResults[row] = new Object();

      analyticsResults[row].title = receivedData[row][0];
      analyticsResults[row].date = parsePublicationDate(receivedData[row][1]);
      analyticsResults[row].url = receivedData[row][1];
      analyticsResults[row].pageViews = receivedData[row][2];
      analyticsResults[row]['clicks'] = new Object(); // we'll use later
      analyticsResults[row]['referals'] = new Object(); // we'll use later

      // now that we no the top stories, we can make queries about them
      render_queue('page-detail',row);
      render_queue('ui-regions',row);
      render_queue('page-time',row);
      render_queue('leave-rate',row);

      // meets the pageviews target?
      var success = iconSuccess;
      if (analyticsResults[row].pageViews < 250) {
        success = iconWarning;
      } else if (analyticsResults[row].pageViews < 300) {
        success = iconSoSo;        
      }

      $(target).append('<tr class="result-'+ row + '">' + 
        '<td>' + 
        '<span class="label">' + parsePublicationDate(analyticsResults[row].url) + '</span>' +
        '<div>' + analyticsResults[row].title + '</div>' +
        '<small><a target="_blank" href="http://news.embl.de' + analyticsResults[row].url + '">'+ analyticsResults[row].url+'</a></small>'+
        '<br/><small>' +
        '<a class="readmore" href="https://analytics.google.com/analytics/web/#report/content-pages/a21480202w75912813p91186979/%3Fexplorer-table.filter%3D' + encodeURIComponent(analyticsResults[row].url) + '" target="_blank">View GA for this URL'+
        '</small>' +
        '</td>' +
        '<td>' + success + analyticsResults[row].pageViews + 
        '</td><td class="tr-referals small"></td><td class="tr-ui-regions"></td><td class="tr-time-on-page"></td><td class="tr-leave-rate"></td></tr>');      

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

function fetch_page_detail(target,dimensions,metrics,filters,shared,resultPosition) {
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
    
    // save the data
    for (var i = 0; i < receivedData.length; i++) {
      analyticsResults[resultPosition]['referals'][parseReferralName(receivedData[i][0])] = receivedData[i][1]; 
    }

    // sort
    // make a list of which keys have the most referals
    var dataSorted = Object.keys(analyticsResults[resultPosition]['referals']).sort(function(a,b){return analyticsResults[resultPosition]['referals'][b]-analyticsResults[resultPosition]['referals'][a]});

    // output the data
    dataSorted.forEach(function(element) {
      $(target+' td.tr-referals').append('<tr><td>' + element +'</td><td>' + analyticsResults[resultPosition]['referals'][element] + '</td></tr>');
    });
      
  });
}

function fetch_ui_regions(target,dimensions,metrics,filters,shared,resultPosition) {
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
    // console.table(receivedData);

    // track where users engaged
    var totalContentClicks = 0,
        totalSiteNavClicks = 0;
    
    for (var i = 0; i < receivedData.length; i++) {
      // is it a UI region?
      if (receivedData[i][0].indexOf('UI Element') >= 0) {
        if (receivedData[i][0].indexOf('UI Element / Content') >= 0) {
          totalContentClicks += Math.floor(receivedData[i][1]);
        } else {
          totalSiteNavClicks += Math.floor(receivedData[i][1]);
        }
      }
    }

    // save the data
    analyticsResults[resultPosition]['clicks'].content = totalContentClicks; 
    analyticsResults[resultPosition]['clicks'].siteNav = totalSiteNavClicks; 

    var engagementPercent = Math.floor(totalContentClicks / (totalContentClicks+Math.floor(analyticsResults[resultPosition].pageViews)) * 1000) / 10; // the number of unique content clicks vs unique page views

    // read out the sums
    // $(target+' td.tr-ui-regions').append('<tr><td>Total clicks</td><td>' + (totalSiteNavClicks + totalContentClicks) + '</td></tr>');
    // $(target+' td.tr-ui-regions').append('<tr><td>Content click ratio</td><td>' + Math.floor(totalContentClicks  / (totalSiteNavClicks + totalContentClicks) * 100 ) + '%</td></tr>');
    $(target + ' td.tr-ui-regions').append('' + totalContentClicks + ' (' + engagementPercent + '%) <br/>');
    var success = iconSuccess;
    if (engagementPercent < 10) {
      success = iconWarning;
    }
    $(target + ' td.tr-ui-regions').prepend(success);
    // $(target + ' td.tr-ui-regions').append('Engagement %: ' + + '<br/>');
  });
}

function fetch_page_time(target,dimensions,metrics,filters,shared,resultPosition) {
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
    // save the data
    analyticsResults[resultPosition].pageTime = results[0].rows[0][1]; 

    var timeOnPage = Math.round((analyticsResults[resultPosition].pageTime / 60) * 100) / 100;
    // meets the pageviews target?
    var success = iconSuccess;
    if (timeOnPage < 2) {
      success = iconWarning;
    } else if (timeOnPage < 3) {
      success = iconSoSo;        
    }

    $(target + ' td.tr-time-on-page').append('' +success + timeOnPage);
  });
}

function fetch_leave_rate(target,dimensions,metrics,filters,shared,resultPosition) {
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
    // save the data
    analyticsResults[resultPosition].bounceRate = results[0].rows[0][1]; 

    // meets the pageviews target?
    var success = iconSuccess;
    if (analyticsResults[resultPosition].bounceRate > 80) {
      success = iconWarning;
    } else if (analyticsResults[resultPosition].bounceRate > 60) {
      success = iconSoSo;        
    }

    var leavePercent = Math.round((analyticsResults[resultPosition].bounceRate) * 100) / 100;
    $(target + ' td.tr-leave-rate').append(success + leavePercent +'%');

    // update table sorting
    // $("#table-report").trigger('update');

    // console.log(analyticsResults[resultPosition]);

    // add pie graph
    var uniqueID = Math.floor(Math.random() * 1000);
    $(target + ' td.tr-leave-rate').append('<div id="leave-container-'+uniqueID+'"></div>');
    var labels = new Array();

    var data = [];
    var colors = ['rgb(218,15,33)','rgb(109,171,73)'];

    // add the negative non 100% portion
    data.push({
      label: analyticsResults[resultPosition].bounceRate,
      value: +(1-(analyticsResults[resultPosition].bounceRate/100)),
      color: colors[1]
    });

    data.push({
      // label: row[0],
      value: +analyticsResults[resultPosition].bounceRate/100,
      color: colors[0]
    });

    new Chart(makeCanvas('leave-container-'+uniqueID)).Pie(data);
  });


}
