
$('#wave-btn').on('click', () => {
    $('#orange-money').hide();
    $('#orange-money').addClass('d-none');
    
    $('#interac').hide();
    $('#interac').addClass('d-none');
    
    $('#wave')
    .removeClass('d-none')  
    .hide()                  
    .fadeIn('slow');   
});
$('#orange-money-btn').on('click', () => {
    $('#wave').hide();
    $('#wave').addClass('d-none');
    
    $('#interac').hide();
    $('#interac').addClass('d-none');

    $('#orange-money')
    .removeClass('d-none')  
    .hide()                  
    .fadeIn('slow');   
});
$('#interac-btn').on('click', () => {
    $('#wave').hide();
    $('#wave').addClass('d-none');

    $('#orange-money').hide();
    $('#orange-money').addClass('d-none');
    
    $('#interac')
    .removeClass('d-none')  
    .hide()                  
    .fadeIn('slow');   
});

