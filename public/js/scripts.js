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

    const imageInput = document.getElementById('newDishImage');
    const imagePreview = document.getElementById('dishImagePreview');
    if (imageInput && imagePreview) {
        const originalImageSrc = imagePreview.src;
        let previewUrl = null;

        imageInput.addEventListener('change', () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                previewUrl = null;
            }

            const file = imageInput.files[0];
            if (!file) {
                imagePreview.src = originalImageSrc;
                return;
            }

            previewUrl = URL.createObjectURL(file);
            imagePreview.src = previewUrl;
        });

        window.addEventListener('pagehide', () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        });
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
