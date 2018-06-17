userToFieldDateFormat(this.getContext().getUser().UserProfile.DateFormat)

function userToFieldDateFormat(userDateFormat) {
    switch (userDateFormat) {
        case "yyyy-MM-dd":
            return "Y-m-d";
        case "MM/dd/yyyy":
            return "m/d/Y";
        case "dd/MM/yyyy":
            return "d/m/Y";
        default:
            return "Y-m-d";
    }
}