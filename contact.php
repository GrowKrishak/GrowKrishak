
<?php
/**
 * GrowKrishak - Contact & Helpdesk
 */
$pageTitle = "Contact & Helpdesk";
require_once __DIR__ . '/includes/header.php';
require_once __DIR__ . '/config/database.php';

$successMsg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = clean_input($_POST['name'] ?? '');
    $email = clean_input($_POST['email'] ?? '');
    $subject = clean_input($_POST['subject'] ?? '');
    $msg = clean_input($_POST['message'] ?? '');

    if (!empty($name) && !empty($email) && !empty($msg)) {
        // In real deployment, save to support_tickets or send mail
        $successMsg = "Thank you, {$name}! Your support ticket has been received. Our agronomist team will respond within 24 hours.";
    }
}
?>

<div class="py-5 bg-white border-bottom">
    <div class="container py-4 text-center">
        <span class="badge bg-success bg-opacity-10 text-success px-3 py-2 rounded-pill fw-semibold mb-2">Support & Inquiry</span>
        <h1 class="display-5 fw-bold text-dark">We're Here to Support Your Farm</h1>
        <p class="fs-5 text-secondary max-w-700 mx-auto">
            Questions about AI crop detection, robot hardware purchase, or government subsidies? Get in touch with our specialist team.
        </p>
    </div>
</div>

<div class="container py-5">
    <div class="row g-5">
        <div class="col-lg-5">
            <h4 class="fw-bold mb-4">Contact Information</h4>
            
            <div class="d-flex align-items-start gap-3 mb-4">
                <div class="rounded-circle bg-success bg-opacity-10 p-3 text-success">
                    <i class="fa-solid fa-phone fs-4"></i>
                </div>
                <div>
                    <h6 class="fw-bold mb-1">Toll-Free Agricultural Helpline</h6>
                    <div class="text-dark fw-semibold fs-5">+91 1800-425-GROW (4769)</div>
                    <small class="text-muted">Monday - Saturday: 7:00 AM - 8:00 PM IST</small>
                </div>
            </div>

            <div class="d-flex align-items-start gap-3 mb-4">
                <div class="rounded-circle bg-success bg-opacity-10 p-3 text-success">
                    <i class="fa-solid fa-envelope fs-4"></i>
                </div>
                <div>
                    <h6 class="fw-bold mb-1">Email Inquiries</h6>
                    <div class="text-dark fw-semibold">support@growkrishak.com</div>
                    <small class="text-muted">Direct technical assistance & API integrations</small>
                </div>
            </div>

            <div class="d-flex align-items-start gap-3 mb-4">
                <div class="rounded-circle bg-success bg-opacity-10 p-3 text-success">
                    <i class="fa-solid fa-location-dot fs-4"></i>
                </div>
                <div>
                    <h6 class="fw-bold mb-1">Headquarters & Robotics Lab</h6>
                    <div class="text-dark">GrowKrishak AgriTech Park, Sector 4</div>
                    <small class="text-muted">Shivajinagar, Pune, Maharashtra 411005, India</small>
                </div>
            </div>
        </div>

        <div class="col-lg-7">
            <div class="p-4 p-md-5 rounded-4 bg-white border shadow-sm">
                <h4 class="fw-bold mb-3">Send Us a Message</h4>
                
                <?php if ($successMsg): ?>
                    <div class="alert alert-success d-flex align-items-center mb-4">
                        <i class="fa-solid fa-circle-check fs-4 me-3"></i>
                        <div><?= e($successMsg) ?></div>
                    </div>
                <?php endif; ?>

                <form method="POST" action="contact.php">
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label fw-semibold small">Full Name</label>
                            <input type="text" name="name" class="form-control" required placeholder="e.g. Ramesh Kumar">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-semibold small">Email Address</label>
                            <input type="email" name="email" class="form-control" required placeholder="name@example.com">
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label fw-semibold small">Subject</label>
                        <select name="subject" class="form-select">
                            <option value="Robot Inquiry">KrishakBot Rover Hardware Inquiry</option>
                            <option value="Disease Diagnosis">Crop Disease & AI Scanner Assistance</option>
                            <option value="Government Subsidy">SMAM Subsidy Consultation</option>
                            <option value="General Support">General Platform Support</option>
                        </select>
                    </div>

                    <div class="mb-4">
                        <label class="form-label fw-semibold small">Message</label>
                        <textarea name="message" rows="4" class="form-control" required placeholder="Describe your farm acreage, crop type, or question..."></textarea>
                    </div>

                    <button type="submit" class="btn btn-gk-primary w-100 py-2">
                        <i class="fa-solid fa-paper-plane me-2"></i> Send Inquiry
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
