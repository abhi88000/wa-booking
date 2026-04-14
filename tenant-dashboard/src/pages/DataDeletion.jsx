export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 max-w-3xl mx-auto text-gray-700">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Deletion Instructions</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: April 14, 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">How to Request Data Deletion</h2>
          <p>If you would like to delete your data from the Project Ping platform by Futurezminds, you can do so through any of the following methods:</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">For Patients / End Users</h2>
          <p>If you have interacted with a business through our WhatsApp booking system and want your data deleted:</p>
          <ol className="list-decimal pl-6 space-y-2 mt-2">
            <li>Send <strong>"DELETE"</strong> to the business WhatsApp number you interacted with.</li>
            <li>Or email us at <strong>support@futurezminds.in</strong> with:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>Your phone number</li>
                <li>The business you interacted with (if known)</li>
                <li>A request to delete your data</li>
              </ul>
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">For Business Users</h2>
          <p>If you are a registered business on our platform and want to delete your account and all associated data:</p>
          <ol className="list-decimal pl-6 space-y-2 mt-2">
            <li>Log in to your dashboard and go to <strong>Settings</strong>.</li>
            <li>Or email us at <strong>support@futurezminds.in</strong> with:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>Your business name</li>
                <li>The registered email address</li>
                <li>A request to delete your account and all data</li>
              </ul>
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">What Gets Deleted</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Patient records (name, phone number)</li>
            <li>Appointment history</li>
            <li>WhatsApp conversation data</li>
            <li>Account credentials and business information</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Processing Time</h2>
          <p>Data deletion requests are processed within <strong>30 days</strong> of receipt. You will receive a confirmation once your data has been permanently removed from our systems.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Contact</h2>
          <p><strong>Email:</strong> support@futurezminds.in</p>
          <p><strong>Website:</strong> futurezminds.in</p>
        </div>
      </section>
    </div>
  );
}
