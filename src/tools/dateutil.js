const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

export default function monthFromString(datestring) {
  var d = new Date(datestring);
  return monthNames[d.getMonth()];
}
