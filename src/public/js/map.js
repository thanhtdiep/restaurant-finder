var map, infoWindow, load;
var curLocation, results, markers = [], infoWindows = [];

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -27.470125, lng: 153.021072 },
        zoom: 8
    });
    infoWindow = new google.maps.InfoWindow();
}

function handleLocationError(browserHasGeolocation, infoWindow, pos) {
    // infoWindow.setPosition(pos);
    alert(browserHasGeolocation ? 'Please press allow to use this feature.' : 'Error: Your browser doesn\'t support geolocation.');
    // infoWindow.open(map);
}

function search() {
    const content = document.getElementById("search").value;
    if (content) {
        getResults(content, null, null, function (data) {
            // Clear old markers before put in new ones if any
            if (markers) deleteMarkers();
            if (data.length !== 0){
                displayResults(data);
                map.setCenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lng) });
                map.setZoom(12);
            } else {
                alert("No results found");
            }
            
        });
    } else {
        alert("Please type in your search keys!");
    }

}

function nearby() {
    //  Get current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var curLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            infoWindow.setPosition(curLocation);
            infoWindow.setContent('You are here');
            infoWindow.open(map);
            map.setCenter(curLocation);
            map.setZoom(14);
            //  Search for nearby restaurant
            getResults(curLocation.lat, curLocation.lng, "search", function (data) {
                // Clear old markers before put in new ones if any
                if (markers) deleteMarkers();
                displayResults(data);
            });
        }, function () {
            handleLocationError(true, infoWindow, map.getCenter());
        });
    } else {
        // For Browser doesn't support Geolocation
        handleLocationError(false, infoWindow, map.getCenter());
    }
}

function getResults(q1, q2, type, cb) {
    // --------------------------------------------------------------------------------------------
    // Using Ajax to access the routes from the server. That route will request
    // the APIs, results then will be returned to server, results are filtered then send 
    // to the front end
    // INPUT:
    //      q1 - use for 1 query key search cases such as name of a restaurant, type of food, etc...
    //      q2 - used in combination with q1 for 2 query keys search cases such as latitude and longtitude, etc...
    //      cb - the callback function used to pass the object back to the parent function where the object is used for other functions asynchronously 
    // --------------------------------------------------------------------------------------------
    var urlQ = null;
    // Loading unpon ajax request
    $(document).ajaxStart(function () {
        $("#loader").css("display", "block");
    });

    $(document).ajaxComplete(function () {
        $("#loader").css("display", "none");
    });

    if (q2 && !type) urlQ = "weather/full?lat=" + q1 + "&lon=" + q2
    else if (q2 && type === "search") urlQ = "search/full?lat=" + q1 + "&lon=" + q2
    else urlQ = "search/full?q=" + q1;
    $.ajax({
        url: urlQ,
        type: 'GET',
        dataType: 'json',
        success: (data, err) => {
            if (err) console.log("Response: " + err);
            cb(data)
        }
    });
}

function displayResults(data) {
    if (data.length !== 0) {
        console.log(data.source);
        document.getElementById("total").textContent = data[0].total;
        for (var i = 0; i < data.length; i++) {
            addMarker(data[i]);
        }
    }
    else {
        // Need to add error handling instead of just console.log [IMPORTANT]
        console.log('No results found');
    }
}

// Sets the map on all markers in the array.
function setMapOnAll(map) {
    for (var i = 0; i < markers.length; i++) {
        markers[i].setMap(map);
    }
}

// Removes the markers from the map, but keeps them in the array.
function clearMarkers() {
    setMapOnAll(null);
}

// Deletes all markers in the array by removing references to them.
function deleteMarkers() {
    clearMarkers();
    markers = [];
}

function createInfoWindowTemplate(props, data) {
    var contentStr = '<h1>' + props.name + '</h1>' +
        '<div class="slideshow-container"><img src="img/arrow-left.png" class="prev" alt="Prev"><div class="slider"><img src=' + props.photos[0].photo.url + ' class="active" alt="" style="width:100%">';
    //  Loop through all the images and add in string 
    for (var i = 1; i < props.photos.length; i++) {
        contentStr +=
            "<img src='" + props.photos[i].photo.url + "' alt='' style='width:100%'>";
    }
    contentStr +=
        "</div><img src='img/arrow-right.png' class='next' alt='Next'>" +
        "</div>";
    contentStr +=
        '<p >Cuisines: ' + props.cuisines + '</p>' +
        '<p >Open hours: ' + props.timings + '</p>' +
        '<p >Address: ' + props.address + ' ' + props.zipcode + '</p>' +
        '<p >Contact: ' + props.phone_numbers + '</p>';

    // An infoWindow template for each marker
    var weatherStr =
        '<div class="weather-form">' +
        '<div class="weather-text"><img src="http://openweathermap.org/img/wn/' + data[0].icon + '@2x.png">' + data[0].weather +
        '<p class="text">Temperature: ' + data[0].temp + ' Celsius</p>' +
        '<p class="text">Wind Speed: ' + data[0].wind_speed + ' km/h</p>' +
        '<p class="text">Humidity: ' + data[0].humidity + ' g/m3</p>' +
        '</div>' +
        '</div>';
    contentStr += weatherStr;
    for (var i = 0; i < props.reviews.length; i++) {
        contentStr +=
            '<div class="reviewForm">' +
            '<div class="profile-name" >' + '<a href="' + props.reviews[i].review.user.profile_url + '">' +
            '<img class="profile-img" src="' + props.reviews[i].review.user.profile_image + '">' + '</a>' +
            props.reviews[i].review.user.name +
            '<div class="rating">' + props.reviews[i].review.rating + '/5<img class="star" src="img/star.png"></div>' +
            '<div class="rating-text">' + props.reviews[i].review.rating_text + '</div>' +
            '</div>' +
            '<div class="review-time">' + props.reviews[i].review.review_time_friendly + '</div>' +
            '<div class="review-text"> \"' + props.reviews[i].review.review_text + '\" </div>' +
            '</div>';
    }
    return contentStr;
}

function imageSlider() {
    // JQuery create back and next button on images sliders
    $(document).ready(function () {
        $('.next').on('click', function () {
            var currentImg = $('.active');
            var nextImg = currentImg.next();

            if (nextImg.length) {
                currentImg.removeClass('active').css('z-index', -10);
                nextImg.addClass('active').css('z-index', 10);
            }
        })

        $('.prev').on('click', function () {
            var currentImg = $('.active');
            var prevImg = currentImg.prev();

            if (prevImg.length) {
                currentImg.removeClass('active').css('z-index', -10);
                prevImg.addClass('active').css('z-index', 10);
            }
        })
    });
}

function addMarker(props) {
    var marker = new google.maps.Marker({
        position: { lat: parseFloat(props.lat), lng: parseFloat(props.lng) },
        map: map,
        icon: './img/restaurant.png'
    })
    // Push new marker into marker array
    markers.push(marker);
    // GET request to OpenWeather API when marker is clicked
    marker.addListener('click', function () {
        getResults(props.lat, props.lng, null, function (data) {
            var contentStr = createInfoWindowTemplate(props, data);
            imageSlider();
            if (infoWindows[0]) {
                infoWindows[0].close();
                infoWindows.pop();
            }
            var infoWindow = new google.maps.InfoWindow({
                content: contentStr
            })
            infoWindows.push(infoWindow);
            infoWindow.open(map, marker);
        });
    })
}

function pageTransition() {
    load = setTimeout(showPage, window.onload);
}

function showPage() {
    document.getElementById("loader").style.display = "none";
    document.getElementById("main").style.display = "block";
}
