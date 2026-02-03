
import React, { useState } from 'react';
import { ShiftRequest, ShiftRequestStatus, ShiftRequestType } from '../../types';
import { updateShiftRequestStatus } from '../../services/shiftService';
import { sendShiftNotification, getShiftTemplates } from '../../services/shiftNotificationService';
import { Button } from '../ui/Button';
import { CheckIcon, CloseIcon } from '../ui/Icons';
import { Modal } from '../ui/Modal';

interface Props {
    request: ShiftRequest;
    isActionable?: boolean;
    onUpdate: () => void;
}

interface ActionConfig {
    isOpen: boolean;
    nextStatus: ShiftRequestStatus | null;
    title: string;
    
    // Notification Flags
    notifyRequesterSms: boolean;
    notifyRequesterTg: boolean;
    notifyProviderSms: boolean; // Only for exchange final approval
    notifyProviderTg: boolean;  // Only for exchange final approval
    notifySupervisorSms: boolean;
    notifySupervisorTg: boolean;
}

export const ShiftRequestCard: React.FC<Props> = ({ request, isActionable = false, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [actionModal, setActionModal] = useState<ActionConfig>({
        isOpen: false,
        nextStatus: null,
        title: '',
        notifyRequesterSms: true,
        notifyRequesterTg: true,
        notifyProviderSms: true,
        notifyProviderTg: true,
        notifySupervisorSms: true,
        notifySupervisorTg: true
    });

    const formatDateToJalali = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('fa-IR');
        } catch (e) {
            return dateStr;
        }
    };

    const getStatusColor = (status: ShiftRequestStatus) => {
        switch (status) {
            case ShiftRequestStatus.APPROVED: return 'bg-green-100 text-green-800 border-green-200';
            case ShiftRequestStatus.REJECTED: return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        }
    };

    const getTypeIcon = (type: ShiftRequestType) => {
        switch (type) {
            case ShiftRequestType.EXCHANGE: return 'fa-exchange-alt';
            case ShiftRequestType.LEAVE: return 'fa-calendar-day';
            case ShiftRequestType.SICK_LEAVE: return 'fa-medkit';
            case ShiftRequestType.INVITATION: return 'fa-briefcase';
            default: return 'fa-file-alt';
        }
    };

    // Open Modal and Load Defaults
    const initiateAction = async (nextStatus: ShiftRequestStatus) => {
        let title = '';
        let settingsKey = '';

        if (nextStatus === ShiftRequestStatus.PENDING_SUPERVISOR) {
            title = 'تایید و ارجاع به مسئول';
            settingsKey = 'PROVIDER_ACCEPTED';
        } else if (nextStatus === ShiftRequestStatus.APPROVED) {
            title = 'تایید نهایی درخواست';
            settingsKey = 'APPROVED';
        } else if (nextStatus === ShiftRequestStatus.REJECTED) {
            title = 'رد درخواست';
            settingsKey = 'REJECTED';
        }

        const templates = await getShiftTemplates();
        const defaults = templates[settingsKey as keyof typeof templates];

        setActionModal({
            isOpen: true,
            nextStatus,
            title,
            notifyRequesterSms: defaults.smsEnabled,
            notifyRequesterTg: defaults.telegramEnabled,
            notifyProviderSms: defaults.smsEnabled,
            notifyProviderTg: defaults.telegramEnabled,
            notifySupervisorSms: defaults.smsEnabled,
            notifySupervisorTg: defaults.telegramEnabled
        });
    };

    const confirmAction = async () => {
        const { nextStatus } = actionModal;
        if (!nextStatus) return;

        setLoading(true);
        try {
            await updateShiftRequestStatus(request.id, nextStatus);
            
            const appUrl = window.location.origin + window.location.pathname;
            const link = `${appUrl}#/shifts`;
            
            // 1. Provider Accepted -> Notify Supervisor
            if (request.request_type === ShiftRequestType.EXCHANGE && nextStatus === ShiftRequestStatus.PENDING_SUPERVISOR && request.supervisor) {
                await sendShiftNotification(
                    'PROVIDER_ACCEPTED', request, request.supervisor, link,
                    { sms: actionModal.notifySupervisorSms, telegram: actionModal.notifySupervisorTg }
                );
            } 
            
            // 2. Approved/Rejected -> Notify Requester
            else if (nextStatus === ShiftRequestStatus.APPROVED || nextStatus === ShiftRequestStatus.REJECTED) {
                const eventType = nextStatus === ShiftRequestStatus.APPROVED ? 'APPROVED' : 'REJECTED';
                
                if (request.requester) {
                    await sendShiftNotification(
                        eventType, request, request.requester, link,
                        { sms: actionModal.notifyRequesterSms, telegram: actionModal.notifyRequesterTg }
                    );
                }
                
                // Notify Provider TOO if Exchange (Separate controls)
                if (request.request_type === ShiftRequestType.EXCHANGE && request.provider) {
                    await sendShiftNotification(
                        eventType, request, request.provider, link,
                        { sms: actionModal.notifyProviderSms, telegram: actionModal.notifyProviderTg }
                    );
                }
            }

            alert('عملیات با موفقیت انجام شد.');
            setActionModal({ ...actionModal, isOpen: false });
            onUpdate();
        } catch (e: any) {
            alert('خطا در بروزرسانی: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`bg-white p-4 rounded-xl shadow-sm border-r-4 transition-all hover:shadow-md ${getStatusColor(request.status)}`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm ml-3">
                        <i className={`fas ${getTypeIcon(request.request_type)}`}></i>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800">{request.request_type}</h4>
                        <p className="text-xs text-gray-500">توسط: {request.requester?.full_name || request.requester?.username}</p>
                    </div>
                </div>
                <div className="text-left">
                    <span className="text-[10px] text-gray-400 block">{formatDateToJalali(request.created_at)}</span>
                    <span className="text-[10px] font-bold mt-1 inline-block">{request.status}</span>
                </div>
            </div>

            <div className="bg-white/50 p-2 rounded mb-3 text-sm">
                <p className="text-gray-700"><strong>تاریخ‌ها:</strong> {request.dates.map(d => formatDateToJalali(d)).join(' ، ')}</p>
                {request.request_type === ShiftRequestType.EXCHANGE && (
                    <p className="text-gray-700 mt-1"><strong>همکار تامین کننده:</strong> {request.provider?.full_name || request.provider?.username || 'نامشخص'}</p>
                )}
                <p className="text-gray-700 mt-1"><strong>مسئول تایید:</strong> {request.supervisor?.full_name || request.supervisor?.username || 'نامشخص'}</p>
            </div>

            {request.description && (
                <div className="mb-3 text-xs text-gray-600 bg-white/30 p-2 rounded italic">
                    {request.description}
                </div>
            )}

            {isActionable && (
                <div className="flex gap-2 mt-4 border-t pt-3 border-black/5">
                    {request.status === ShiftRequestStatus.PENDING_PROVIDER && (
                        <Button variant="success" size="sm" fullWidth onClick={() => initiateAction(ShiftRequestStatus.PENDING_SUPERVISOR)}>
                            <CheckIcon className="ml-1" /> تایید و ارسال به مسئول
                        </Button>
                    )}
                    {request.status === ShiftRequestStatus.PENDING_SUPERVISOR && (
                        <Button variant="success" size="sm" fullWidth onClick={() => initiateAction(ShiftRequestStatus.APPROVED)}>
                            <CheckIcon className="ml-1" /> تایید نهایی
                        </Button>
                    )}
                    <Button variant="danger" size="sm" fullWidth onClick={() => initiateAction(ShiftRequestStatus.REJECTED)}>
                        <CloseIcon className="ml-1" /> رد درخواست
                    </Button>
                </div>
            )}

            {/* Confirmation Modal */}
            <Modal isOpen={actionModal.isOpen} onClose={() => setActionModal({ ...actionModal, isOpen: false })} title={actionModal.title}>
                <div className="p-4 space-y-4">
                    <p className="text-sm text-gray-600 mb-4">لطفاً گزینه‌های اطلاع‌رسانی برای افراد مرتبط را بررسی و تایید کنید:</p>
                    
                    {/* Scenario 1: Provider Accepting -> Notify Supervisor */}
                    {actionModal.nextStatus === ShiftRequestStatus.PENDING_SUPERVISOR && (
                        <div className="bg-indigo-50 p-3 rounded border">
                            <p className="font-bold text-xs text-indigo-800 mb-2">اطلاع‌رسانی به مسئول ({request.supervisor?.full_name})</p>
                            <div className="flex gap-4">
                                <label className="flex items-center"><input type="checkbox" checked={actionModal.notifySupervisorSms} onChange={e => setActionModal({...actionModal, notifySupervisorSms: e.target.checked})} className="ml-2"/> پیامک</label>
                                <label className="flex items-center"><input type="checkbox" checked={actionModal.notifySupervisorTg} onChange={e => setActionModal({...actionModal, notifySupervisorTg: e.target.checked})} className="ml-2"/> تلگرام</label>
                            </div>
                        </div>
                    )}

                    {/* Scenario 2: Final Approval/Rejection */}
                    {(actionModal.nextStatus === ShiftRequestStatus.APPROVED || actionModal.nextStatus === ShiftRequestStatus.REJECTED) && (
                        <>
                            {/* Always Notify Requester */}
                            <div className="bg-blue-50 p-3 rounded border">
                                <p className="font-bold text-xs text-blue-800 mb-2">اطلاع‌رسانی به درخواست‌دهنده ({request.requester?.full_name})</p>
                                <div className="flex gap-4">
                                    <label className="flex items-center"><input type="checkbox" checked={actionModal.notifyRequesterSms} onChange={e => setActionModal({...actionModal, notifyRequesterSms: e.target.checked})} className="ml-2"/> پیامک</label>
                                    <label className="flex items-center"><input type="checkbox" checked={actionModal.notifyRequesterTg} onChange={e => setActionModal({...actionModal, notifyRequesterTg: e.target.checked})} className="ml-2"/> تلگرام</label>
                                </div>
                            </div>

                            {/* Notify Provider IF Exchange */}
                            {request.request_type === ShiftRequestType.EXCHANGE && (
                                <div className="bg-purple-50 p-3 rounded border">
                                    <p className="font-bold text-xs text-purple-800 mb-2">اطلاع‌رسانی به همکار جایگزین ({request.provider?.full_name})</p>
                                    <div className="flex gap-4">
                                        <label className="flex items-center"><input type="checkbox" checked={actionModal.notifyProviderSms} onChange={e => setActionModal({...actionModal, notifyProviderSms: e.target.checked})} className="ml-2"/> پیامک</label>
                                        <label className="flex items-center"><input type="checkbox" checked={actionModal.notifyProviderTg} onChange={e => setActionModal({...actionModal, notifyProviderTg: e.target.checked})} className="ml-2"/> تلگرام</label>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="secondary" onClick={() => setActionModal({ ...actionModal, isOpen: false })}>انصراف</Button>
                        <Button variant="primary" onClick={confirmAction} loading={loading}>تایید و انجام عملیات</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
