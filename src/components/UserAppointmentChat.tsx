import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, MessageCircle, Send, X } from 'lucide-react';
import { useAuth, useUser } from '@clerk/react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { formatAppointmentTime } from '../appointmentSchedule';

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface UserAppointment {
  id: string;
  reference_code: string;
  patient_name: string;
  service_name: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
  chat_status: string;
}

interface UserMessage {
  id: string;
  appointment_id: string;
  sender_role: string;
  sender_name: string;
  message: string;
  created_at: string;
}

function getClinicInformationAnswer(question: string, siteContent: ReturnType<typeof useHealthCenter>['siteContent'], isFilipino: boolean) {
  const query = question.toLocaleLowerCase();
  const phone = siteContent.settings.contactPhone;
  const email = siteContent.settings.contactEmail;

  if (/contact|phone|call|email|telepono|tawag|ugnay/.test(query)) {
    const details = [phone, email].filter(Boolean).join(' · ');
    return details || (isFilipino
      ? 'Walang nakalistang pampublikong numero o email sa ngayon. Tingnan ang impormasyon ng klinika para sa pinakabagong detalye.'
      : 'No public phone number or email is currently listed. Check the clinic information page for updates.');
  }

  if (/address|location|where|saan|lokasyon|address/.test(query)) {
    return isFilipino ? siteContent.settings.clinicAddressFil : siteContent.settings.clinicAddress;
  }

  if (/hour|schedule|open|time|oras|iskedyul|bukas/.test(query)) {
    return [
      isFilipino ? siteContent.settings.clinicHoursFil : siteContent.settings.clinicHours,
      isFilipino ? siteContent.settings.doctorHoursFil : siteContent.settings.doctorHours,
    ].filter(Boolean).join('\n');
  }

  if (/outreach|program|barangay|outreach|komunidad/.test(query) && siteContent.outreach.length > 0) {
    return siteContent.outreach.map((item) => `${isFilipino ? item.titleFil : item.title}: ${item.scheduleDate} · ${item.location}`).join('\n');
  }

  const service = siteContent.services.find((item) => {
    const title = isFilipino ? item.titleFil : item.title;
    return title.length > 2 && query.includes(title.toLocaleLowerCase());
  });
  if (service) {
    const description = isFilipino ? service.fullDescFil : service.fullDesc;
    const schedule = isFilipino ? service.scheduleFil : service.schedule;
    const requirements = isFilipino ? service.requirementsFil : service.requirements;
    return [
      description,
      schedule && `${isFilipino ? 'Iskedyul' : 'Schedule'}: ${schedule}`,
      requirements.length > 0 && `${isFilipino ? 'Mga kailangan' : 'Requirements'}: ${requirements.join(', ')}`,
    ].filter(Boolean).join('\n');
  }

  if (/service|serbisyo|health|clinic|klinika/.test(query) && siteContent.services.length > 0) {
    return siteContent.services.map((item) => isFilipino ? item.titleFil : item.title).join(', ');
  }

  return isFilipino
    ? 'Makakatulong ako sa pampublikong impormasyon tungkol sa mga serbisyo, oras, lokasyon, outreach, at contact. Para sa payong medikal o agarang tulong, makipag-ugnayan sa health center o emergency services.'
    : 'I can help with public information about services, hours, location, outreach, and contact details. For medical advice or urgent help, contact the health center or emergency services.';
}

const getDisplayMessage = (message: string) => {
  const legacyConfirmation = message.match(
    /^Your appointment for (.+) on (\d{4}-\d{2}-\d{2}) at (.+?) has been automatically confirmed\. You can view this schedule in your appointment chat\./,
  );
  if (!legacyConfirmation) return message;

  const [, service, date, time] = legacyConfirmation;
  return `This is an automated message.\n\nYour appointment for ${service} on ${date} at ${time} has been automatically confirmed. You can view the schedule in your appointment chat.\n\nFilipino:\nAwtomatikong mensahe ito. Kumpirmado na ang iyong appointment para sa ${service} sa ${date}, ganap na ${time}. Maaari mong tingnan ang iskedyul sa chat ng iyong appointment.`;
};

export const UserAppointmentChat: React.FC = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const {
    language,
    siteContent,
    messagesOpen,
    setMessagesOpen,
    messagesReferenceCode,
    clearMessagesReferenceCode,
    markAppointmentMessagesRead,
  } = useHealthCenter();
  const [appointments, setAppointments] = useState<UserAppointment[]>([]);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState('');
  const [activeView, setActiveView] = useState<'messages' | 'assistant'>('messages');
  const [assistantDraft, setAssistantDraft] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [error, setError] = useState('');
  const [lastStatuses, setLastStatuses] = useState<Record<string, string>>({});

  const loadChat = async () => {
    try {
      if (!user) return;
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Appointment chat could not be loaded.');
      const data = await response.json() as { appointments: UserAppointment[]; messages: UserMessage[] };
      const normalizedAppointments = data.appointments.map((appointment) => ({
        ...appointment,
        status: String(appointment.status).toLowerCase(),
        chat_status: String(appointment.chat_status || 'closed'),
      }));
      normalizedAppointments.forEach((appointment) => {
        const previousStatus = lastStatuses[appointment.id];
        if (previousStatus && previousStatus !== appointment.status) {
          window.dispatchEvent(new CustomEvent('appointment-status-change', { detail: { status: appointment.status, referenceCode: appointment.reference_code } }));
        }
      });
      setLastStatuses(Object.fromEntries(normalizedAppointments.map((appointment) => [appointment.id, appointment.status])));
      setAppointments(normalizedAppointments);
      setMessages(data.messages);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Appointment chat could not be loaded.');
    }
  };

  useEffect(() => {
    if (!messagesOpen) return;
    void loadChat();
    const timer = window.setInterval(() => void loadChat(), 3000);
    return () => window.clearInterval(timer);
  }, [messagesOpen]);

  const selected = useMemo(() => appointments.find((appointment) => appointment.id === selectedId), [appointments, selectedId]);
  const selectedMessages = useMemo(() => messages.filter((message) => message.appointment_id === selectedId), [messages, selectedId]);
  const latestSelectedMessageId = selectedMessages.at(-1)?.id;
  const isFilipino = language === 'fil';

  useEffect(() => {
    if (!messagesReferenceCode) return;
    const appointment = appointments.find((item) => item.reference_code === messagesReferenceCode);
    if (!appointment) return;
    setSelectedId(appointment.id);
    clearMessagesReferenceCode();
  }, [appointments, clearMessagesReferenceCode, messagesReferenceCode]);

  useEffect(() => {
    if (!messagesOpen || !selected || !latestSelectedMessageId) return;
    void markAppointmentMessagesRead(selected.id).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Messages could not be marked as read.');
    });
  }, [messagesOpen, selected?.id, latestSelectedMessageId, markAppointmentMessagesRead]);

  if (!messagesOpen) return null;

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !draft.trim()) return;
    try {
      if (!user) return;
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'message', appointmentId: selected.id, message: draft.trim(), senderName: user.fullName || 'Patient' }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || 'Message could not be sent.');
      }
      setDraft('');
      await loadChat();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Message could not be sent.');
    }
  };

  const askClinicAssistant = (event: FormEvent) => {
    event.preventDefault();
    const question = assistantDraft.trim();
    if (!question) return;
    const answer = getClinicInformationAnswer(question, siteContent, isFilipino);
    setAssistantMessages((current) => [
      ...current,
      { id: `question-${Date.now()}`, role: 'user', text: question },
      { id: `answer-${Date.now()}`, role: 'assistant', text: answer },
    ]);
    setAssistantDraft('');
  };

  const cancelSelectedAppointment = async () => {
    if (!selected || !['pending', 'confirmed'].includes(selected.status)) return;
    if (!window.confirm('Cancel this appointment request?')) return;
    setError('');
    try {
      if (!user) throw new Error('Sign in to cancel this appointment.');
      const token = await getToken();
      if (!token) throw new Error('A Clerk session token could not be created.');
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'patient_cancel', appointmentId: selected.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Appointment could not be cancelled.');
      await loadChat();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Appointment could not be cancelled.');
    }
  };

  return (
    <section role="dialog" aria-modal="true" aria-labelledby="messages-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessagesOpen(false); }}>
      <div className="flex max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-5xl flex-col overflow-hidden border border-[#dfe6e1] bg-[#f8faf7] shadow-2xl sm:max-h-[92dvh]">
        <header className="flex shrink-0 items-center justify-between border-b border-[#dfe6e1] bg-white px-4 py-3 sm:px-5 sm:py-4">
          <div><div className="text-xs font-bold text-[#17645c]">Your appointments</div><h2 id="messages-title" className="mt-1 text-xl font-bold text-[#17312e]">Messages</h2></div>
          <button type="button" onClick={() => setMessagesOpen(false)} aria-label="Close messages" className="p-2 text-[#66736f] hover:bg-[#f1f4f1]"><X className="h-5 w-5" /></button>
        </header>
        <nav aria-label="Messages and clinic information" className="flex shrink-0 gap-2 border-b border-[#dfe6e1] bg-white px-4 py-2">
          <button type="button" onClick={() => setActiveView('messages')} aria-pressed={activeView === 'messages'} className={`min-h-10 px-3 text-xs font-bold ${activeView === 'messages' ? 'bg-[#17645c] text-white' : 'text-[#66736f] hover:bg-[#f1f4f1]'}`}>Messages</button>
          <button type="button" onClick={() => setActiveView('assistant')} aria-pressed={activeView === 'assistant'} className={`min-h-10 px-3 text-xs font-bold ${activeView === 'assistant' ? 'bg-[#17645c] text-white' : 'text-[#66736f] hover:bg-[#f1f4f1]'}`}>{isFilipino ? 'Impormasyon ng klinika' : 'Clinic information'}</button>
        </nav>
        {activeView === 'assistant' ? (
          <section className="flex min-h-0 flex-1 flex-col bg-[#f8faf7]">
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              <p className="border border-[#dfe6e1] bg-white p-3 text-sm text-[#66736f]">
                {isFilipino
                  ? 'Lokal na gabay para sa pampublikong impormasyon lamang. Huwag maglagay ng personal o pangkalusugang detalye.'
                  : 'Local help for public clinic information only. Do not enter personal or health details.'}
              </p>
              {assistantMessages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <p className={`max-w-[85%] whitespace-pre-line rounded-xl px-4 py-3 text-sm ${message.role === 'user' ? 'bg-[#17645c] text-white' : 'bg-white text-[#17312e] shadow-sm'}`}>{message.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={askClinicAssistant} className="flex shrink-0 gap-2 border-t border-[#dfe6e1] bg-white p-3">
              <input value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} maxLength={500} placeholder={isFilipino ? 'Magtanong tungkol sa klinika' : 'Ask about the clinic'} className="h-11 min-w-0 flex-1 rounded-full border border-[#cfd8d2] px-4 text-sm outline-none focus:border-[#17645c]" />
              <button type="submit" disabled={!assistantDraft.trim()} aria-label={isFilipino ? 'Ipadala ang tanong' : 'Ask question'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#17645c] text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </form>
          </section>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="overflow-hidden bg-white lg:grid lg:grid-cols-[300px_1fr]">
          <aside className={`${selected ? 'hidden lg:block' : 'block'} border-b border-[#dfe6e1] lg:border-b-0 lg:border-r`}>
            {appointments.map((appointment) => (
              <button key={appointment.id} type="button" onClick={() => setSelectedId(appointment.id)} className={`w-full border-b border-[#edf1ee] px-4 py-4 text-left hover:bg-[#f4f7f4] ${selectedId === appointment.id ? 'bg-[#edf3ef]' : ''}`}>
                <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-[#17312e]">{appointment.service_name}</div><div className="mt-1 text-xs text-[#66736f]">{appointment.reference_code}</div></div><span className={`px-2 py-1 text-[10px] font-bold uppercase ${appointment.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : appointment.status === 'completed' ? 'bg-sky-100 text-sky-800' : ['cancelled', 'rejected', 'missed'].includes(appointment.status) ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{appointment.status}</span></div>
                <div className="mt-2 text-xs text-[#66736f]">{appointment.preferred_date} · {formatAppointmentTime(appointment.preferred_time)}</div>
              </button>
            ))}
            {appointments.length === 0 && <p className="p-4 text-sm text-[#66736f]">No conversations yet</p>}
          </aside>

          <div className={`${selected ? 'block' : 'hidden'} lg:block`}>
            {!selected ? <div className="flex min-h-[360px] items-center justify-center text-sm text-[#66736f]">Select an appointment</div> : (
              <div className="flex min-h-[min(420px,55dvh)] flex-col">
                <div className="flex min-w-0 items-center gap-2 border-b border-[#dfe6e1] px-3 py-3 sm:px-4"><button type="button" onClick={() => setSelectedId('')} className="shrink-0 lg:hidden" aria-label="Back to conversations"><ChevronLeft className="h-5 w-5 text-[#17645c]" /></button><MessageCircle className="h-4 w-4 shrink-0 text-[#17645c]" /><div className="min-w-0"><div className="truncate text-sm font-bold">{selected.service_name}</div><div className="text-[11px] text-[#66736f]">{selected.chat_status === 'closed' ? 'Chat closed by clinic staff' : 'Chat open'}</div></div></div>
                {['pending', 'confirmed'].includes(selected.status) && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfe6e1] bg-white px-3 py-2 sm:px-4"><p className="text-[11px] text-[#66736f]">Need to change your appointment? Message clinic staff here.</p><button type="button" onClick={() => void cancelSelectedAppointment()} className="min-h-10 border border-rose-200 px-3 text-xs font-bold text-rose-700">Cancel appointment</button></div>}
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
                  {selectedMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${message.sender_role === 'user' ? 'rounded-br-sm bg-[#17645c] text-white' : 'rounded-bl-sm bg-[#edf1ee] text-[#17312e]'}`}><div className="whitespace-pre-line">{getDisplayMessage(message.message)}</div><div className={`mt-1 text-[10px] ${message.sender_role === 'user' ? 'text-white/70' : 'text-[#66736f]'}`}>{message.sender_name}</div></div></div>
                  ))}
                </div>
                {selected.chat_status === 'open' ? (
                  <form onSubmit={sendMessage} className="flex shrink-0 gap-2 border-t border-[#dfe6e1] bg-white p-2.5 sm:p-3"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message clinic staff" className="h-11 min-w-0 flex-1 rounded-full border border-[#cfd8d2] px-4 text-sm outline-none focus:border-[#17645c]" /><button type="submit" aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#17645c] text-white"><Send className="h-4 w-4" /></button></form>
                ) : <div className="border-t border-[#dfe6e1] bg-white px-4 py-4 text-center text-xs font-bold text-[#66736f]">This chat has been closed by clinic staff</div>}
              </div>
            )}
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-rose-800">{error}</p>}
        </div>
        )}
      </div>
    </section>
  );
};
