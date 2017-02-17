// Take a screenshot with html2canvas.
// Requires foundation for modal.
// Expects a div with class .tools to insert icon into
// High res method based off of https://github.com/niklasvh/html2canvas/issues/241#issuecomment-247705673
$(document).ready(function() {


  function takeHighResScreenshot(srcEl, destIMG, scaleFactor) {
    // Save original size of element
    // We add in a bit of padding to the right and bottom
    var originalWidth = srcEl.offsetWidth+70;
    var originalHeight = srcEl.offsetHeight+20;
    // Force px size (no %, EMs, etc)
    srcEl.style.width = originalWidth + "px";
    srcEl.style.height = originalHeight + "px";

    // Position the element at the top left of the document because of bugs in html2canvas. The bug exists when supplying a custom canvas, and offsets the rendering on the custom canvas based on the offset of the source element on the page; thus the source element MUST be at 0, 0.
    // See html2canvas issues #790, #820, #893, #922
    srcEl.style.position = "absolute";
    srcEl.style.top = "10px";
    srcEl.style.left = "40px";

    // Create scaled canvas
    var scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = originalWidth * scaleFactor;
    scaledCanvas.maxWidth = originalWidth * scaleFactor;
    scaledCanvas.height = originalHeight * scaleFactor;
    scaledCanvas.style.width = originalWidth + "px";
    scaledCanvas.style.height = originalHeight + "px";
    var scaledContext = scaledCanvas.getContext("2d");
    scaledContext.scale(scaleFactor, scaleFactor);

    html2canvas(srcEl, { background: '#fff', canvas: scaledCanvas })
    .then(function(canvas) {
      var element = document.createElement('a');
      element.setAttribute('href', canvas.toDataURL());
      element.setAttribute('download', destIMG+'.png');

      element.style.display = 'none';
      document.body.appendChild(element);

      element.click();

      document.body.removeChild(element); // remove download link

      srcEl.removeAttribute("style"); // reset the appearance
      $('#screenshotModal').foundation('open');
    });
  };

  // add the screenshot button
  $('.tools').append('<a href="#" class="small button secondary takeScreenShot"><span class="icon icon-generic" data-icon="!"> </span> Screenshot this report</a>');

  $('.takeScreenShot').on('click',function(){
    $('#screenshotModal').foundation('open');
    var elem = new Foundation.Reveal($('#screenshotModal'));
    var src = document.getElementById("content");
    var img = "screenshot-img";
    takeHighResScreenshot(src, img, 2); // This time we provide desired scale factor directly, no more messing with DPI
  });

  // create banner to be used when screenshoting
  $('body').append('<div class="reveal" id="screenshotModal" data-reveal data-overlay="false">' +
                      '<h1>Taking all the pixels.</h1>' +
                      '<p class="lead">Mind the mess while we prepare a screenshot.</p>' +
                      '<p>By the time your read this, a download should have been generated. Unless you\'re using an older version of Safari. In which case, clikc here [link to come].</p>' +
                      '<button class="close-button" data-close aria-label="Close modal" type="button">' +
                        '<span aria-hidden="true">&times;</span>' +
                      '</button>' +
                    '</div>');

});
