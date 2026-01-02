export function buildUpiPayUri(params: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  transactionNote: string;
  transactionRef: string;
}): string {
  const uri = new URL('upi://pay');

  uri.searchParams.set('pa', params.payeeVpa);
  uri.searchParams.set('pn', params.payeeName);
  uri.searchParams.set('am', params.amount.toFixed(2));
  uri.searchParams.set('cu', 'INR');
  uri.searchParams.set('tn', params.transactionNote);
  uri.searchParams.set('tr', params.transactionRef);

  return uri.toString();
}
