import { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";
import { FaCalendarAlt, FaMapMarkerAlt, FaChair, FaMoneyBillWave } from "react-icons/fa";

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [event, setEvent] = useState(null);
  // Data & UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [otp, setOtp] = useState("");
  const [isOtpVisible, setIsOtpVisible] = useState(false);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data } = await api.get(`/events/${id}`);
        setEvent(data);
      } catch {
        setError("Failed to load event details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  /**
   * Create payment order and open Razorpay. Resolves with payment response when verified.
   */
  const payNow = useCallback(async () => {
    if (!window.Razorpay) {
      setError("Razorpay SDK not loaded. Reload the page.");
      throw new Error("Razorpay SDK not loaded");
    }

    setSuccessMsg("Creating payment order...");
    setError("");

    const response = await api.post("/payment/order", { eventId: id });
    if (!response || (response.status !== 200 && response.status !== 201)) {
      const msg = response?.data?.message || "Failed to create order";
      setError(msg);
      throw new Error(msg);
    }

    const order = response.data;

    if (order?.code === "ALREADY_BOOKED") {
      setAlreadyBooked(true);
      setSuccessMsg("You have already booked this event.");
      return null;
    }

    if (order?.code === "ALREADY_PAID") {
      setIsPaymentComplete(true);
      setSuccessMsg("You have already paid for this event. Proceed to confirm booking.");
      return null;
    }

    return await new Promise((resolve, reject) => {
      const options = {
        amount: order.amount,
        currency: order.currency,
        description: `Payment for ${order.eventTitle || "event"}`,
        handler: async paymentResponse => {
          setSuccessMsg("Verifying payment...");
          try {
            const verifyResponse = await api.post("/payment/verify", {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            });

            if (verifyResponse?.data?.status === "success") {
              setIsPaymentComplete(true);
              setSuccessMsg(`Payment successful! Payment ID: ${paymentResponse.razorpay_payment_id}`);
              resolve(paymentResponse);
            } else {
              reject(new Error("Payment verification failed."));
            }
          } catch (err) {
            reject(err);
          }
        },
        modal: { ondismiss: () => reject(new Error("Payment dismissed")) },
        image: "https://your-domain.com/logo.png",
        key: "rzp_test_SoV2GiONCBJYNz",
        name: "Eventora",
        order_id: order.id,
        prefill: {
          contact: user?.phone || "",
          email: user?.email || "",
          name: user?.name || "",
        },
        theme: { color: "#3399cc" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  }, [id, user]);

  const handleBooking = useCallback(async () => {
    if (alreadyBooked) {
      setSuccessMsg("You have already booked this event.");
      return;
    }

    if (!user) {
      navigate("/login");
      return;
    }

    if (!event) {
      setError("Event data is not available.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setSuccessMsg("");

    try {
      // If payment not done yet, start payment flow first
      if (!isPaymentComplete) {
        await payNow();

        // On success (or if already paid) send OTP and prompt user
        await api.post("/bookings/send-otp", { eventId: event._id });
        setIsOtpVisible(true);
        setSuccessMsg("Payment complete. OTP sent to your email. Please verify to confirm booking.");
        return;
      }

      // If OTP is visible, verify & request booking
      if (isOtpVisible) {
        await api.post("/bookings", { eventId: event._id, otp });
        setSuccessMsg("Booking requested! Awaiting admin confirmation.");
        setIsOtpVisible(false);
        setOtp("");
        setIsPaymentComplete(false);
        setEvent(prev => ({
          ...prev,
          availableSeats: prev.availableSeats > 0 ? prev.availableSeats - 1 : 0,
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Booking failed");
    } finally {
      setIsProcessing(false);
    }
  }, [alreadyBooked, user, event, isPaymentComplete, isOtpVisible, otp, navigate, payNow]);

  if (isLoading) return <div className="text-center py-20 text-xl font-semibold">Loading...</div>;
  if (error && !event) return <div className="text-center py-20 text-xl text-red-500">{error || "Event not found"}</div>;

  const isSoldOut = event?.availableSeats <= 0;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden mt-8">
      {event.image ? (
        <img src={event.image} alt={event.title} className="w-full h-80 object-cover" />
      ) : (
        <div className="w-full h-64 bg-gray-900 flex items-center justify-center text-white/50 text-6xl font-black uppercase tracking-widest">
          {event.category}
        </div>
      )}

      <div className="p-8 md:p-12">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
          <div>
            <div className="inline-block bg-gray-200 text-gray-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3">
              {event.category}
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{event.title}</h1>
            <p className="text-gray-600 text-lg leading-relaxed mb-6">{event.description}</p>
          </div>

          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 min-w-[300px] w-full md:w-auto shrink-0 shadow-sm">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Booking Details</h3>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 text-gray-600">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-900 shrink-0">
                  <FaMoneyBillWave />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-400 uppercase">Ticket Price</p>
                  <p className="font-bold text-gray-800 text-lg">
                    {event.ticketPrice === 0 ? <span className="text-green-500">Free</span> : `₹${event.ticketPrice}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-gray-600">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-900 shrink-0">
                  <FaChair />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-400 uppercase">Availability</p>
                  <p className="font-bold text-gray-800">
                    <span className={event.availableSeats < 10 ? "text-orange-500" : ""}>{event.availableSeats}</span> / {event.totalSeats}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-gray-600">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-900 shrink-0">
                  <FaCalendarAlt />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-400 uppercase">Date</p>
                  <p className="font-bold text-gray-800">{new Date(event.date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-gray-600">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-900 shrink-0">
                  <FaMapMarkerAlt />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-400 uppercase">Location</p>
                  <p className="font-bold text-gray-800">{event.location}</p>
                </div>
              </div>
            </div>

            {isOtpVisible && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Enter OTP to Confirm</label>
                <input
                  type="text"
                  required
                  placeholder="6-digit code"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-700 transition shadow-sm font-bold tracking-widest text-center text-lg"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength="6"
                />
              </div>
            )}

            <button
              onClick={handleBooking}
              disabled={isSoldOut || isProcessing || (isOtpVisible && otp.length < 6)}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition shadow-lg ${isSoldOut ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-gray-900 hover:bg-black text-white hover:shadow-xl hover:-translate-y-1"}`}>
              {isProcessing ? "Processing..." : isOtpVisible ? "Verify OTP & Confirm" : isSoldOut ? "Sold Out" : "Book Now"}
            </button>
            {error && <p className="text-red-500 mt-4 text-center font-medium bg-red-50 p-2 rounded">{error}</p>}
            {successMsg && <p className="text-green-600 mt-4 text-center font-medium bg-green-50 p-2 rounded">{successMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetail;
