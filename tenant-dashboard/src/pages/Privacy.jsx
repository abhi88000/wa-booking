export default function Privacy() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 max-w-3xl mx-auto text-gray-700">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: April 14, 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Introduction</h2>
          <p>Futurezminds ("we", "our", "us") operates the Project Ping platform, a WhatsApp-based appointment booking and management system. This Privacy Policy explains how we collect, use, and protect information when businesses and their customers use our services.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Information We Collect</h2>
          <p className="mb-2">We collect the following types of information:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Business Information:</strong> Business name, address, phone number, email, and staff details provided during registration.</li>
            <li><strong>Patient/Customer Information:</strong> Name, phone number, and appointment details shared through WhatsApp conversations or dashboard bookings.</li>
            <li><strong>WhatsApp Messages:</strong> Messages exchanged between patients and the automated booking system for the purpose of scheduling appointments.</li>
            <li><strong>Usage Data:</strong> Login activity, feature usage, and general analytics to improve our service.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. How We Use Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To facilitate appointment booking, reminders, and rescheduling via WhatsApp.</li>
            <li>To provide the business dashboard for managing appointments, doctors, services, and patients.</li>
            <li>To send automated appointment reminders and notifications.</li>
            <li>To improve and maintain our platform.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Data Sharing</h2>
          <p>We do not sell or share personal data with third parties except:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Meta/WhatsApp:</strong> Messages are transmitted through the WhatsApp Business Platform (Meta Platforms, Inc.) as required for the messaging service.</li>
            <li><strong>Cloud Hosting:</strong> Data is stored on secure cloud servers (AWS) with encryption.</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Data Security</h2>
          <p>We implement industry-standard security measures including encrypted connections (SSL/TLS), secure database access, and role-based authentication to protect your data.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Data Retention</h2>
          <p>We retain data for as long as the business account is active. Upon account termination, data is deleted within 90 days. Patients can request deletion of their data at any time by contacting the business or emailing us.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data.</li>
            <li>Opt out of automated messages by messaging "STOP" on WhatsApp.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">8. Contact Us</h2>
          <p>For any privacy-related questions or requests, contact us at:</p>
          <p className="mt-1"><strong>Email:</strong> support@futurezminds.in</p>
          <p><strong>Website:</strong> futurezminds.in</p>
        </div>
      </section>
    </div>
  );
}
