// ========================================
// TIMEZONE HELPER - Convert to IST
// ========================================
function toIST(dateString) {
  // If already an IST formatted string, return as is
  if (typeof dateString === 'string' && dateString.includes('IST')) {
    return dateString;
  }
  
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateString);
      return String(dateString);
    }
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.error('Error converting to IST:', error, dateString);
    return String(dateString);
  }
}