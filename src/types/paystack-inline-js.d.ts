/** The parts of @paystack/inline-js we use (the package ships no types). See its README. */
declare module "@paystack/inline-js" {
  interface PopupCallbacks {
    onSuccess?: (transaction: { id: number; reference: string; message: string }) => void;
    onCancel?: () => void;
    onError?: (error: { message: string }) => void;
    onLoad?: (response: { id: number; accessCode: string }) => void;
  }
  export default class PaystackPop {
    resumeTransaction(accessCode: string, callbacks?: PopupCallbacks): unknown;
  }
}
