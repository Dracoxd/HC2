import React, { useEffect, useRef, useState } from 'react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { AlertCircle, CalendarDays, CheckCircle2, Clock, X } from 'lucide-react';
import { useAuth, useUser } from '@clerk/react';
import {
  APPOINTMENT_TIME_SLOTS,
  formatAppointmentTime,
  getAppointmentTimePeriod,
  getEarliestAppointmentDate,
  getLatestAppointmentDate,
  isAppointmentTimeAvailable,
} from '../appointmentSchedule';
import { formatPhilippinePhoneNumber, isValidPhilippinePhoneNumber, normalizePhilippinePhoneNumber } from '../philippinePhone';

interface AppointmentReceipt {
  referenceCode: string;
  status: 'pending' | 'confirmed';
  createdAt: string;
}

interface PublicSlotSetting {
  date: string;
  time: string;
  blocked: boolean;
}

interface UnavailableAppointmentSlot {
  date: string;
  time: string;
  hasRegularBooking: boolean;
  hasPriorityBooking: boolean;
}

interface PendingAppointmentRequest {
  referenceCode: string;
  preferredDate: string;
  preferredTime: string;
  status: 'pending' | 'confirmed';
}

const priorityCategoryOptions = [
  { value: 'pwd', label: 'Person with disability (PWD)' },
  { value: 'senior_citizen', label: 'Senior citizen' },
  { value: 'pregnant_lactating', label: 'Pregnant or lactating' },
] as const;

export const OutreachBookingModal: React.FC = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const {
    t,
    language,
    bookingModalOpen,
    setBookingModalOpen,
    appointmentRequestAvailability,
    markAppointmentRequestStatus,
    openMessagesForAppointment,
    selectedProgramForBooking,
    siteContent,
  } = useHealthCenter();
  const services = siteContent.services;
  const [serviceId, setServiceId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [houseApartmentNumber, setHouseApartmentNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [priorityCategories, setPriorityCategories] = useState<string[]>([]);
  const [zone, setZone] = useState('1. Aguho');
  const [now, setNow] = useState(() => new Date());
  const [preferredDate, setPreferredDate] = useState(() => getEarliestAppointmentDate());
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [attendanceConsent, setAttendanceConsent] = useState(false);
  const [arrivalConsent, setArrivalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [receipt, setReceipt] = useState<AppointmentReceipt | null>(null);
  const [slotSettings, setSlotSettings] = useState<PublicSlotSetting[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableAppointmentSlot[]>([]);
  const [pendingRequest, setPendingRequest] = useState<PendingAppointmentRequest | null>(null);
  const [pendingRequestLoaded, setPendingRequestLoaded] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const appointmentFormRef = useRef<HTMLFormElement>(null);
  const prefilled = useRef(false);
  const earliestDate = getEarliestAppointmentDate(now);
  const latestDate = getLatestAppointmentDate(now);
  const isAnimalBiteService = services.find((service) => service.id === serviceId)?.category === 'animal_bite';
  const metadata = user?.unsafeMetadata;
  const profileName = [
    user?.firstName,
    typeof metadata?.middleName === 'string' ? metadata.middleName : '',
    user?.lastName,
    typeof metadata?.suffix === 'string' ? metadata.suffix : '',
  ].filter(Boolean).join(' ');
  const profilePhone = typeof metadata?.contactNumber === 'string'
    ? metadata.contactNumber
    : user?.primaryPhoneNumber?.phoneNumber || '';
  const dateBlocked = slotSettings.some((setting) => setting.date === preferredDate && setting.time === 'all_day' && setting.blocked);
  const isTimeBlocked = (time: string) => {
    const period = getAppointmentTimePeriod(time);
    return slotSettings.some((setting) => setting.date === preferredDate
      && setting.blocked
      && (setting.time === time || setting.time === period));
  };
  const isTimeTaken = (time: string) => unavailableSlots.some((slot) => (
    slot.date === preferredDate
    && slot.time === time
    && (priorityCategories.length > 0 || isAnimalBiteService
      ? slot.hasPriorityBooking
      : slot.hasRegularBooking || slot.hasPriorityBooking)
  ));

  useEffect(() => {
    if (!bookingModalOpen) return;
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [bookingModalOpen]);

  useEffect(() => {
    setPreferredDate((current) => current < earliestDate
      ? earliestDate
      : current > latestDate ? latestDate : current);
  }, [earliestDate, latestDate]);

  useEffect(() => {
    if (!dateBlocked
      && isAppointmentTimeAvailable(preferredDate, preferredTime, now)
      && !isTimeBlocked(preferredTime)
      && !isTimeTaken(preferredTime)) return;
    const nextAvailableTime = APPOINTMENT_TIME_SLOTS.find((time) => (
      !dateBlocked
      && isAppointmentTimeAvailable(preferredDate, time, now)
      && !isTimeBlocked(time)
      && !isTimeTaken(time)
    ));
    if (nextAvailableTime) setPreferredTime(nextAvailableTime);
  }, [dateBlocked, preferredDate, preferredTime, now, slotSettings, unavailableSlots, priorityCategories]);

  useEffect(() => {
    if (bookingModalOpen && selectedProgramForBooking && services.some((service) => service.id === selectedProgramForBooking)) {
      setServiceId(selectedProgramForBooking);
    }
  }, [bookingModalOpen, selectedProgramForBooking, services]);

  useEffect(() => {
    const isMaternityService = services.find((service) => service.id === serviceId)?.category === 'maternity';
    setPriorityCategories((current) => {
      if (isMaternityService && Number(age) < 60) {
        return current.includes('pregnant_lactating') ? current : [...current, 'pregnant_lactating'];
      }
      return current.filter((category) => category !== 'pregnant_lactating');
    });
  }, [age, serviceId, services]);

  useEffect(() => {
    if (!bookingModalOpen) {
      setReceipt(null);
      setError('');
      setServiceId('');
      setPatientName('');
      setPhone('');
      setAge('');
      setHouseApartmentNumber('');
      setStreetName('');
      setChiefComplaint('');
      setGuardianName('');
      setGuardianRelationship('');
      setGuardianConsent(false);
      setPriorityCategories([]);
      setZone('1. Aguho');
      setPrivacyConsent(false);
      setAttendanceConsent(false);
      setArrivalConsent(false);
      setFormStep(1);
      prefilled.current = false;
    }
  }, [bookingModalOpen]);

  useEffect(() => {
    if (!bookingModalOpen) {
      setPendingRequestLoaded(false);
      return;
    }
    let active = true;
    const loadAvailability = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Sign in to view appointment availability.');
        const response = await fetch('/api/appointments', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const result = await response.json() as {
          slotSettings?: PublicSlotSetting[];
          unavailableSlots?: UnavailableAppointmentSlot[];
          appointments?: Array<{
            reference_code: string;
            preferred_date: string;
            preferred_time: string;
            status: string;
            patient_name?: string;
            phone?: string;
            address?: string | null;
            age?: number | null;
            zone?: string;
            service_id?: string;
            guardian_name?: string | null;
            guardian_relationship?: string | null;
            chief_complaint?: string | null;
            priority_categories?: string | null;
            created_at?: string;
          }>;
          error?: string;
        };
        if (!response.ok || !Array.isArray(result.slotSettings) || !Array.isArray(result.unavailableSlots)) {
          throw new Error(result.error || 'Appointment availability could not be loaded.');
        }
        if (active) {
          if (!prefilled.current) {
            const previousAppointment = [...(result.appointments ?? [])]
              .sort((first, second) => (second.created_at ?? '').localeCompare(first.created_at ?? ''))[0];
            setPatientName(previousAppointment?.patient_name || profileName);
            setPhone(normalizePhilippinePhoneNumber(previousAppointment?.phone || profilePhone));
            const priorAddress = previousAppointment?.address || '';
            const addressSeparator = priorAddress.indexOf(',');
            setHouseApartmentNumber(addressSeparator < 0 ? priorAddress : priorAddress.slice(0, addressSeparator).trim());
            setStreetName(addressSeparator < 0 ? '' : priorAddress.slice(addressSeparator + 1).trim());
            const previousAge = previousAppointment?.age == null ? '' : String(previousAppointment.age);
            setAge(previousAge);
            setGuardianName(previousAppointment?.guardian_name || '');
            setGuardianRelationship(previousAppointment?.guardian_relationship || '');
            setGuardianConsent(false);
            setChiefComplaint(previousAppointment?.chief_complaint || '');
            setPriorityCategories((current) => {
              const priorCategories = (previousAppointment?.priority_categories || '')
                .split(',')
                .filter((category) => category === 'pwd' || category === 'pregnant_lactating');
              return Number(previousAge) >= 60
                ? [...priorCategories, 'senior_citizen']
                : priorCategories;
            });
            if (previousAppointment?.zone) setZone(previousAppointment.zone);
            if (!selectedProgramForBooking
              && previousAppointment?.service_id
              && services.some((service) => service.id === previousAppointment.service_id)) {
              setServiceId(previousAppointment.service_id);
            }
            prefilled.current = true;
          }
          setSlotSettings(result.slotSettings);
          setUnavailableSlots(result.unavailableSlots);
          const activeAppointment = result.appointments?.find((appointment) => ['pending', 'confirmed'].includes(appointment.status.toLowerCase()));
          setPendingRequest(activeAppointment ? {
            referenceCode: activeAppointment.reference_code,
            preferredDate: activeAppointment.preferred_date,
            preferredTime: activeAppointment.preferred_time,
            status: activeAppointment.status.toLowerCase() === 'confirmed' ? 'confirmed' : 'pending',
          } : null);
          setPendingRequestLoaded(true);
          setAvailabilityError('');
        }
      } catch (caught) {
        if (active) {
          setAvailabilityError(caught instanceof Error ? caught.message : 'Appointment availability could not be loaded.');
          setPendingRequestLoaded(false);
        }
      }
    };
    void loadAvailability();
    const timer = window.setInterval(() => void loadAvailability(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bookingModalOpen, getToken, profileName, profilePhone, selectedProgramForBooking, services]);

  if (!bookingModalOpen) return null;

  const isFilipino = language === 'fil';
  const canSubmitAppointment = appointmentRequestAvailability === 'available';
  const selectedService = services.find((service) => service.id === serviceId);
  const isMinor = age !== '' && Number(age) <= 17;
  const timeBlocked = isTimeBlocked(preferredTime);
  const timeTaken = isTimeTaken(preferredTime);
  const slotUnavailable = dateBlocked
    || timeBlocked
    || timeTaken
    || !isAppointmentTimeAvailable(preferredDate, preferredTime, now);

  const handleClose = () => setBookingModalOpen(false);

  const handleContinueToSchedule = () => {
    if (!isValidPhilippinePhoneNumber(phone)) {
      setError(isFilipino
        ? 'Maglagay ng wastong Philippine mobile number na may 10 digit pagkatapos ng +63.'
        : 'Enter a valid Philippine mobile number with 10 digits after +63.');
      return;
    }
    if (age === '' || !/^\d{1,3}$/.test(age) || Number(age) > 110) {
      setError(isFilipino ? 'Maglagay ng edad mula 0 hanggang 110.' : 'Enter an age from 0 to 110.');
      return;
    }
    if (!attendanceConsent) {
      setError(isFilipino ? 'Lagyan ng tsek ang mahalagang paalala bago magpatuloy.' : 'Check the important reminder before continuing.');
      return;
    }
    if (!arrivalConsent) {
      setError(isFilipino ? 'Kumpirmahing darating ka 30 minuto bago ang appointment.' : 'Confirm that you will arrive 30 minutes before the appointment.');
      return;
    }
    if (isMinor && (!guardianName.trim() || !guardianRelationship || !guardianConsent)) {
      setError(isFilipino
        ? 'Kailangan ang detalye at pagdalo ng magulang o guardian para sa pasyenteng 17 taong gulang pababa.'
        : 'Patients aged 17 and younger need a parent or guardian’s details and attendance confirmation.');
      return;
    }
    if (appointmentFormRef.current?.reportValidity()) {
      setError('');
      setFormStep(2);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!pendingRequestLoaded) {
      setError(isFilipino ? 'Sinusuri muna kung may nakabinbing request. Subukan muli sandali.' : 'Checking for a pending request. Please try again in a moment.');
      return;
    }
    if (pendingRequest) return;
    if (!selectedService) {
      setError(isFilipino ? 'Walang available na serbisyo para sa appointment request.' : 'No services are currently available for appointment requests.');
      return;
    }
    if (!canSubmitAppointment) {
      setError(isFilipino ? 'Hindi available ang appointment request sa ngayon.' : 'Appointment request availability is still being checked.');
      return;
    }
    if (!isValidPhilippinePhoneNumber(phone)) {
      setError(isFilipino
        ? 'Maglagay ng wastong Philippine mobile number na may 10 digit pagkatapos ng +63.'
        : 'Enter a valid Philippine mobile number with 10 digits after +63.');
      return;
    }
    if (age === '' || !/^\d{1,3}$/.test(age) || Number(age) > 110) {
      setError(isFilipino ? 'Maglagay ng edad mula 0 hanggang 110.' : 'Enter an age from 0 to 110.');
      return;
    }
    if (slotUnavailable) {
      setError(isFilipino ? 'Hindi available ang napiling petsa o oras. Pumili ng ibang schedule.' : 'The selected date or time is unavailable. Please choose another schedule.');
      return;
    }
    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in to submit an appointment.');
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientName,
          phone: formatPhilippinePhoneNumber(phone),
          age: Number(age),
          houseApartmentNumber,
          streetName,
          chiefComplaint,
          guardianName,
          guardianRelationship,
          guardianConsent,
          priorityCategories,
          zone,
          serviceId,
          preferredDate,
          preferredTime,
          privacyConsent,
          attendanceConsent,
          arrivalConsent,
        }),
      });
      const responseBody = await response.text();
      let result: AppointmentReceipt & {
        error?: string;
        activeAppointment?: PendingAppointmentRequest;
      };
      try {
        result = JSON.parse(responseBody) as AppointmentReceipt & {
          error?: string;
          activeAppointment?: PendingAppointmentRequest;
        };
      } catch {
        throw new Error(isFilipino
          ? 'Pansamantalang hindi magamit ang serbisyo ng appointment. Subukan muli mamaya.'
          : `Appointment service is temporarily unavailable (HTTP ${response.status}). Please try again later.`);
      }
      if (!response.ok) {
        if (response.status === 409 && result.activeAppointment) {
          setPendingRequest(result.activeAppointment);
          setPendingRequestLoaded(true);
          markAppointmentRequestStatus(result.activeAppointment.status);
        }
        const message = response.status === 401
          ? 'Your sign-in could not be verified. Check the Clerk environment variables in Vercel, then redeploy.'
          : result.error || 'Could not submit your appointment request.';
        throw new Error(message);
      }
      setPendingRequest({
        referenceCode: result.referenceCode,
        preferredDate,
        preferredTime,
        status: result.status,
      });
      markAppointmentRequestStatus(result.status);
      setReceipt(result);
      openMessagesForAppointment(result.referenceCode);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your appointment request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="appointment-title" className="my-0 max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl sm:my-5 sm:max-h-[92vh]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:gap-5 sm:px-7 sm:py-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Quintin De Borja Health Center</div>
            <h2 id="appointment-title" className="mt-1 text-lg font-bold text-slate-950 sm:text-2xl">{receipt ? (receipt.status === 'confirmed' ? (isFilipino ? 'Kumpirmado ang appointment' : 'Appointment confirmed') : (isFilipino ? 'Natanggap ang request' : 'Request received')) : (isFilipino ? 'Online appointment request' : 'Request an appointment')}</h2>
            {!receipt && <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{isFilipino ? 'Ilagay ang iyong detalye at napiling schedule.' : 'Enter your details and preferred schedule.'}</p>}
          </div>
          <button onClick={handleClose} aria-label="Close appointment form" className="p-2 text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </header>

        {receipt ? (
          <div className="px-5 sm:px-7 py-8" aria-live="polite">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-7 h-7 text-teal-800 shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-slate-950">{receipt.status === 'confirmed'
                  ? (isFilipino ? 'Awtomatikong nakumpirma ang iyong appointment.' : 'Your appointment was automatically confirmed.')
                  : (isFilipino ? 'Nakatala ang iyong appointment request.' : 'Your appointment request is recorded.')}</h3>
                <p className="mt-2 text-sm text-slate-600">{receipt.status === 'confirmed'
                  ? (isFilipino ? 'Nagpadala kami ng kumpirmasyon sa iyong appointment chat kasama ang napiling serbisyo, petsa, at oras.' : 'A confirmation with your selected service, date, and time is available in your appointment chat.')
                  : (isFilipino ? 'Naghihintay ito ng pagsusuri ng kawani dahil hindi ito awtomatikong makumpirma para sa napiling schedule. Makikita mo ang update sa appointment chat.' : 'It is waiting for staff review because it could not be automatically confirmed for the selected schedule. Updates will appear in your appointment chat.')}</p>
                <p className="mt-4 text-sm text-slate-700">{selectedService?.title}</p>
                <p className="mt-1 text-sm text-slate-600">{preferredDate} · {formatAppointmentTime(preferredTime)} · {zone}</p>
                <p className="mt-4 text-xs text-slate-500">{isFilipino ? 'Reference number' : 'Request reference'}: <strong className="font-mono text-slate-900">{receipt.referenceCode}</strong></p>
                <button onClick={() => { openMessagesForAppointment(receipt.referenceCode); handleClose(); }} className="mt-6 px-4 py-2.5 bg-teal-900 text-white text-sm font-bold rounded-md hover:bg-teal-950">{isFilipino ? 'Buksan ang chat' : 'Open appointment chat'}</button>
              </div>
            </div>
          </div>
        ) : pendingRequest ? (
          <div className="space-y-4 px-4 py-6 sm:px-7 sm:py-8" role="status" aria-live="polite">
            <div className="border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <h3 className="text-base font-bold">{pendingRequest.status === 'confirmed'
                ? (isFilipino ? 'May aktibo ka pang kumpirmadong appointment' : 'You already have an active accepted appointment')
                : (isFilipino ? 'May request ka pang sinusuri' : 'You already have a request under review')}</h3>
              <p className="mt-2 text-sm leading-relaxed">
                {pendingRequest.status === 'confirmed'
                  ? (isFilipino
                    ? 'Kumpletuhin o kanselahin muna ang appointment na ito bago magpadala ng panibagong request.'
                    : 'Complete or cancel this appointment before submitting another request.')
                  : (isFilipino
                    ? 'Maghintay ng aksyon ng clinic staff bago magpadala ng panibagong appointment request.'
                    : 'Please wait for clinic staff to review this request before sending another appointment request.')}
              </p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-slate-500">{isFilipino ? 'Reference number' : 'Request reference'}</dt><dd className="break-all font-mono font-bold text-slate-900">{pendingRequest.referenceCode}</dd></div>
              <div><dt className="text-xs font-semibold text-slate-500">{isFilipino ? 'Petsa at oras' : 'Preferred schedule'}</dt><dd className="font-semibold text-slate-900">{pendingRequest.preferredDate} · {formatAppointmentTime(pendingRequest.preferredTime)}</dd></div>
            </dl>
            <p className="text-xs text-slate-500">{isFilipino ? 'Awtomatikong susuriin muli ang status habang bukas ang pahinang ito.' : 'This page will automatically check again while it is open.'}</p>
          </div>
        ) : !pendingRequestLoaded ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600 sm:px-7" role="status">
            {availabilityError || (isFilipino
              ? 'Sinusuri ang mga nakabinbing appointment request...'
              : 'Checking for pending appointment requests...')}
          </p>
        ) : (
          <form
            ref={appointmentFormRef}
            onSubmit={(event) => {
              if (formStep === 1) {
                event.preventDefault();
                handleContinueToSchedule();
              } else {
                void handleSubmit(event);
              }
            }}
            className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-7 sm:py-6"
          >
            <div className="flex items-center gap-3" aria-label={isFilipino ? `Hakbang ${formStep} ng 2` : `Step ${formStep} of 2`}>
              <span className="shrink-0 text-xs font-bold text-[#0f4d3c]">{isFilipino ? `Hakbang ${formStep} / 2` : `Step ${formStep} of 2`}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7eee9]" role="progressbar" aria-valuemin={1} aria-valuemax={2} aria-valuenow={formStep}>
                <div className={`h-full rounded-full bg-[#2c7a5f] transition-[width] ${formStep === 1 ? 'w-1/2' : 'w-full'}`} />
              </div>
              <span className="text-xs font-semibold text-[#66736f]">{formStep === 1 ? (isFilipino ? 'Iyong detalye' : 'Your details') : (isFilipino ? 'Schedule' : 'Schedule')}</span>
            </div>
            {appointmentRequestAvailability === 'checking' && (
              <p role="status" className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {isFilipino ? 'Tinitingnan ang availability ng appointment...' : 'Checking appointment availability...'}
              </p>
            )}
            {formStep === 1 ? <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="appointment-service" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Serbisyo' : 'Service'}</label>
                <select id="appointment-service" required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700">
                  <option value="" disabled>{isFilipino ? 'Pumili ng serbisyo' : 'Choose a service'}</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{isFilipino ? service.titleFil : service.title}</option>)}
                </select>
                {services.length === 0 && <p role="status" className="mt-2 text-xs text-amber-800">{isFilipino ? 'Walang kasalukuyang nailathalang serbisyo para sa appointment request.' : 'There are no published services available for appointment requests.'}</p>}
              </div>
              <div>
                <label htmlFor="appointment-name" className="mb-1 block text-sm font-semibold text-slate-800">{t.formFullName} *</label>
                <input id="appointment-name" required minLength={2} maxLength={120} autoComplete="name" value={patientName} onChange={(event) => setPatientName(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-phone" className="mb-1 block text-sm font-semibold text-slate-800">{t.formPhone} *</label>
                <div className="flex">
                  <span className="inline-flex min-h-12 items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3.5 text-base text-slate-700">+63</span>
                  <input
                    id="appointment-phone"
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    minLength={10}
                    maxLength={16}
                    pattern="9[0-9]{9}"
                    value={phone}
                    onChange={(event) => setPhone(normalizePhilippinePhoneNumber(event.target.value))}
                    placeholder="9XX XXX XXXX"
                    aria-describedby="appointment-phone-hint"
                    className="min-h-12 w-full rounded-r-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
                <p id="appointment-phone-hint" className="mt-1 text-xs text-slate-600">{isFilipino ? 'Maglagay ng 10 digit na nagsisimula sa 9.' : 'Enter 10 digits starting with 9.'}</p>
              </div>
              <div>
                <label htmlFor="appointment-house-number" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'House / apartment number' : 'House / apartment number'} *</label>
                <input id="appointment-house-number" required maxLength={100} autoComplete="address-line1" value={houseApartmentNumber} onChange={(event) => setHouseApartmentNumber(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-street-name" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Street name' : 'Street name'} *</label>
                <input id="appointment-street-name" required minLength={2} maxLength={150} autoComplete="address-line2" value={streetName} onChange={(event) => setStreetName(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-zone" className="mb-1 block text-sm font-semibold text-slate-800">{t.formZone} *</label>
                <select id="appointment-zone" required value={zone} onChange={(event) => setZone(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700">
                  <option>1. Aguho</option><option>2. Martirez</option><option>3. Poblacion</option>
                </select>
              </div>
              <div>
                <label htmlFor="appointment-age" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Edad' : 'Age'} *</label>
                <input
                  id="appointment-age"
                  required
                  type="text"
                  inputMode="numeric"
                  pattern="(?:0|[1-9][0-9]?|10[0-9]|110)"
                  maxLength={3}
                  value={age}
                  onChange={(event) => {
                    const nextAge = event.target.value.replace(/\D/g, '').slice(0, 3);
                    const qualifiesAsSenior = nextAge !== '' && Number(nextAge) >= 60;
                    setAge(nextAge);
                    setPriorityCategories((current) => qualifiesAsSenior
                      ? [...current.filter((category) => category !== 'pregnant_lactating'), ...(current.includes('senior_citizen') ? [] : ['senior_citizen'])]
                      : current.filter((category) => category !== 'senior_citizen'));
                  }}
                  className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              <fieldset className="sm:col-span-2 rounded-md border border-slate-300 p-3">
                <legend className="px-1 text-sm font-semibold text-slate-800">{isFilipino ? 'Priority category (opsyonal; piliin lahat ng naaangkop)' : 'Priority category (optional; select all that apply)'}</legend>
                {isAnimalBiteService && <p className="mb-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm font-medium text-orange-900">
                  {isFilipino
                    ? 'Awtomatikong priority appointment ang Animal Bite dahil mahalaga ang agarang anti-rabies vaccination. Pumunta rin agad sa klinika para sa pagsusuri.'
                    : 'Animal Bite is automatically prioritized because timely rabies vaccination is important. Please also visit the clinic promptly for assessment.'}
                </p>}
                <div className="grid gap-2 sm:grid-cols-3">
                  {priorityCategoryOptions.map(({ value, label }) => (
                    <label key={value} className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={value === 'senior_citizen' ? Number(age) >= 60 : priorityCategories.includes(value)}
                        disabled={(value === 'senior_citizen' && (!age || Number(age) < 60))
                          || (value === 'pregnant_lactating' && Number(age) >= 60)}
                        onChange={(event) => {
                          if (value === 'senior_citizen') return;
                          setPriorityCategories((current) => event.target.checked
                            ? [...current, value]
                            : current.filter((category) => category !== value));
                        }}
                        className="h-4 w-4 shrink-0 accent-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {isMinor && (
                <fieldset className="sm:col-span-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                  <legend className="px-1 text-sm font-semibold text-amber-950">{isFilipino ? 'Impormasyon ng magulang o guardian' : 'Parent or guardian details'}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="guardian-name" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Pangalan ng guardian' : 'Guardian name'} *</label>
                      <input id="guardian-name" required minLength={2} maxLength={120} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
                    </div>
                    <div>
                      <label htmlFor="guardian-relationship" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Relasyon sa pasyente' : 'Relationship to patient'} *</label>
                      <select id="guardian-relationship" required value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700">
                        <option value="" disabled>{isFilipino ? 'Pumili ng relasyon' : 'Choose relationship'}</option>
                        <option value="Parent">Parent</option>
                        <option value="Legal guardian">Legal guardian</option>
                        <option value="Other guardian">Other guardian</option>
                      </select>
                    </div>
                    <label className="flex items-start gap-3 text-sm leading-relaxed text-amber-950 sm:col-span-2">
                      <input type="checkbox" required checked={guardianConsent} onChange={(event) => setGuardianConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal-800" />
                      <span>{isFilipino ? 'Kinukumpirma kong sasamahan ng nakalistang magulang o guardian ang pasyente.' : 'I confirm the listed parent or guardian will accompany the patient.'}</span>
                    </label>
                  </div>
                </fieldset>
              )}
              <div className="sm:col-span-2">
                <label htmlFor="appointment-chief-complaint" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Pangunahing reklamo o dahilan ng pagbisita' : 'Health Concern:'} *</label>
                <textarea id="appointment-chief-complaint" required minLength={2} maxLength={2000} rows={4} value={chiefComplaint} onChange={(event) => setChiefComplaint(event.target.value)} placeholder={isFilipino ? 'Ilarawan nang maikli ang iyong nararamdaman o serbisyong kailangan.' : 'Briefly describe your concern or the service you need.'} className="w-full resize-y rounded-md border border-slate-300 px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-start gap-3 border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
                  <input type="checkbox" required checked={attendanceConsent} onChange={(event) => setAttendanceConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal-800" />
                  <span><strong className="font-bold">{isFilipino ? 'Mahalagang paalala: ' : 'Important reminder: '}</strong>{isFilipino ? 'Nauunawaan kong makakansela ang appointment ko kapag hindi ako dumating sa takdang oras, at kailangan kong magsumite muli ng request.' : 'I understand that missing my appointment will cancel it, and I’ll need to submit a new request.'}</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-start gap-3 border border-slate-200 p-3 text-sm leading-relaxed text-slate-700">
                  <input type="checkbox" required checked={arrivalConsent} onChange={(event) => setArrivalConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal-800" />
                  <span>{isFilipino ? 'Nauunawaan kong dapat akong dumating sa health center nang hindi bababa sa 30 minuto bago ang oras ng aking appointment.' : 'I understand I should arrive at the health center at least 30 minutes before my scheduled appointment.'}</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <button type="button" disabled={!selectedService || !attendanceConsent || !arrivalConsent || (isMinor && (!guardianName.trim() || !guardianRelationship || !guardianConsent))} onClick={handleContinueToSchedule} className="mt-1 min-h-12 w-full rounded-sm bg-[#0f4d3c] px-4 py-3 text-base font-bold text-white hover:bg-[#2c7a5f] disabled:cursor-not-allowed disabled:opacity-60">
                  {isFilipino ? 'Magpatuloy sa schedule' : 'Continue to schedule'}
                </button>
              </div>
            </div> : <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <p className="sm:col-span-2 text-sm text-slate-600">
                {isFilipino
                  ? `Pumili ng schedule mula ${earliestDate} hanggang ${latestDate} (rolling 30-araw na window).`
                  : `Choose a schedule from ${earliestDate} through ${latestDate} (rolling 30-day window).`}
              </p>
              <div>
                <label htmlFor="appointment-date" className="mb-1 block text-sm font-semibold text-slate-800">{t.formDate} *</label>
                <input id="appointment-date" required type="date" min={earliestDate} max={latestDate} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-time" className="mb-1 block text-sm font-semibold text-slate-800">{t.formTimeSlot} *</label>
                <select id="appointment-time" required value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700">
                  {APPOINTMENT_TIME_SLOTS.map((time) => {
                    const unavailable = !isAppointmentTimeAvailable(preferredDate, time, now)
                      || isTimeBlocked(time)
                      || isTimeTaken(time)
                      || dateBlocked;
                    return <option key={time} value={time} disabled={unavailable}>{formatAppointmentTime(time)}{isTimeTaken(time) || dateBlocked || isTimeBlocked(time) ? ' · Unavailable' : ''}</option>;
                  })}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-start gap-3 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-600">
                  <input type="checkbox" required checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal-800" />
                  <span>{isFilipino ? 'Alinsunod sa Republic Act No. 10173 (Data Privacy Act of 2012), pumapayag akong kolektahin at gamitin ng health center staff ang aking personal at pangkalusugang impormasyon para suriin at tugunan ang appointment request na ito.' : 'Under Republic Act No. 10173 (the Data Privacy Act of 2012), I consent to health center staff collecting and using my personal and health information to review and respond to this appointment request.'}</span>
                </label>
              </div>
            </div>}

            {slotUnavailable && <p role="status" className="text-sm font-semibold text-rose-800">{isFilipino ? 'Hindi available ang napiling petsa o oras. Pumili ng ibang schedule.' : 'This date or time is unavailable or already booked. Choose another schedule.'}</p>}
            {availabilityError && <p role="status" className="text-xs text-amber-800">{isFilipino ? 'Hindi ma-check ang availability. Susuriin muli ang napiling schedule kapag ipinadala.' : 'Availability could not be checked. The server will verify your selected schedule when you submit.'}</p>}

            {error && <p role="alert" className="flex items-start gap-2 text-sm text-rose-800"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</p>}

            {formStep === 2 && <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <button type="button" onClick={() => { setError(''); setFormStep(1); }} className="min-h-11 flex-1 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:flex-none">{isFilipino ? 'Bumalik' : 'Back'}</button>
                <button type="button" onClick={handleClose} className="min-h-11 flex-1 rounded-md px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:flex-none">{isFilipino ? 'Kanselahin' : 'Cancel'}</button>
              </div>
              <button type="submit" disabled={submitting || slotUnavailable || !canSubmitAppointment || !selectedService || !privacyConsent || !attendanceConsent || !arrivalConsent} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-[#0f4d3c] px-5 py-2.5 text-base font-bold text-white hover:bg-[#2c7a5f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><CalendarDays className="h-4 w-4" />{submitting ? (isFilipino ? 'Ipinapadala...' : 'Sending...') : (isFilipino ? 'Ipadala ang request' : 'Send request')}</button>
            </div>}
          </form>
        )}
      </section>
    </div>
  );
};
