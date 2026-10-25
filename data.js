// data.js - अत्र केवलं दत्तांश-सङ्केतः (Dynamic Data API) अस्ति

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwDmV5NDkfntxrfRDufrOO0hUMB6yamo_FvVUr-TyMwUDNz0p-QmJZZZIP_HVxN86kVhw/exec";

// Global Variables - These will be populated dynamically from Google Sheets
let acharyaPasswords = {};
let vedaAcharyaMapping = {};
let timetableData = {};
let studentsData = [];
let holidaysData = [];
let messagesData = [];
let fetchedLogs = [];
let fetchedNotifications = [];

// New Variables for Settings & Avalokanam
let settingsData = {};
let avalokanamData = [];