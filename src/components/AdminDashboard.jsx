import { useState } from "react";
import AdminOverview from "./AdminOverview";
import AdminTickets from "./AdminTickets";
import AdminTenants from "./AdminTenants";
import AdminMessages from "./AdminMessages";
import AdminSettings from "./AdminSettings";
import AdminPayments from "./AdminPayments";
import AdminDocuments from "./AdminDocuments";

export default function AdminDashboard({ onLogout, sharedTenants, setSharedTenants,
