// data.js - अत्र केवलं दत्तांश-सङ्केतः (Dynamic Data API) अस्ति

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzJzhU2ymVmuGli0LlWF009mWRBIgNAzmdy4OWMHAeDKbE29i3etnAhb2c-AjnjmNGqbQ/exec";

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