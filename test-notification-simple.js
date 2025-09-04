// Simple notification test script
// Run this in the browser console while on any webpage with the extension installed

console.log('Testing notification system...');

// Test basic notification
chrome.runtime.sendMessage({
  action: 'testNotification'
}, (response) => {
  if (response && response.success) {
    console.log('✅ Test notification sent successfully');
  } else {
    console.error('❌ Failed to send test notification:', response);
  }
});

// Test wardrobe notification
setTimeout(() => {
  chrome.runtime.sendMessage({
    action: 'showNotification',
    data: {
      title: 'Added to Wardrobe!',
      message: 'Test item saved successfully',
      type: 'success',
      icon: '👕',
      duration: 3000,
      actionText: 'View Wardrobe',
      actionType: 'view-wardrobe'
    }
  }, (response) => {
    if (response && response.success) {
      console.log('✅ Wardrobe notification sent successfully');
    } else {
      console.error('❌ Failed to send wardrobe notification:', response);
    }
  });
}, 2000);

// Test generation complete notification
setTimeout(() => {
  chrome.runtime.sendMessage({
    action: 'showNotification',
    data: {
      title: 'Outfit Ready!',
      message: 'Your try-on result is ready to view',
      type: 'success',
      icon: '🎉',
      duration: 4000,
      actionText: 'View Outfits',
      actionType: 'view-outfits'
    }
  }, (response) => {
    if (response && response.success) {
      console.log('✅ Generation complete notification sent successfully');
    } else {
      console.error('❌ Failed to send generation complete notification:', response);
    }
  });
}, 4000);

console.log('Test notifications scheduled. Make sure the popup is closed to see notification windows.'); 