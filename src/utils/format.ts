export const formatIndianNumber = (num: number, currency: boolean = false): string => {
    if (currency) {
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    return num.toLocaleString('en-IN');
};
