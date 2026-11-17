/*!
* Start Bootstrap - Business Casual v7.0.9 (https://startbootstrap.com/theme/business-casual)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-business-casual/blob/master/LICENSE)
*/
// Highlights current date on contact page
window.addEventListener('DOMContentLoaded', event => {
    const listHoursArray = document.body.querySelectorAll('.list-hours li');
    if (listHoursArray.length > 0) {
        listHoursArray[new Date().getDay()].classList.add(('today'));
    }

    document.querySelectorAll('.dish-form').forEach(form => {
        const reviewInput = form.querySelector('#newdishReview');
        const priceInput = form.querySelector('#newdishPrice');
        if (!reviewInput || !priceInput) {
            return;
        }

        form.addEventListener('submit', event => {
            reviewInput.step = 'any';
            priceInput.step = 'any';
            const isValid = form.reportValidity();
            reviewInput.step = '0.5';
            priceInput.step = '1';

            if (!isValid) {
                event.preventDefault();
            }
        });
    });
});
