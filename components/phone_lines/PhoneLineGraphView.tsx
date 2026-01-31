import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PhoneLine, RouteNode } from '../../types';
import { getPhoneLineByNumber } from '../../supabaseService';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { CopyIcon, EditIcon, NodeIcon, WarningIcon } from '../ui/Icons';
import { useSupabaseContext } from '../../SupabaseContext';
import { ColorDisplay } from '../ui/ColorDisplay';

const NodeCard: React.FC<{ routeNode: RouteNode }> = ({ routeNode }) => {
  const { wireColors } = useSupabaseContext();

  if (!routeNode.node) {
    return (
      <div className="bg-red-100 border-red-500 border-2 rounded-lg p-4 text-center shadow-md w-full md:w-48">
        <WarningIcon className="text-red-600 text-3xl mx-auto mb-2" />
        <p className="font-bold">خطا: گره یافت نشد</p>
      </div>
    );
  }

  const { node, wire_1_color_name, wire_2_color_name } = routeNode;
  const color1Def = wireColors.find(c => c.name === wire_1_color_name);
  const color2Def = wireColors.find(c => c.name === wire_2_color_name);

  return (
    <div className="bg-white rounded-lg p-4 text-center shadow-lg border-t-4 border-indigo-500 w-full md:w-48 flex-shrink-0 relative z-10">
      <NodeIcon className="text-3xl text-indigo-500 mx-auto mb-2" />
      <h3 className="text-lg font-bold text-gray-800 truncate" title={node.name}>{node.name}</h3>
      <p className="text-sm text-gray-500 mb-3">{node.type}</p>
      <div className="bg-gray-100 p-2 rounded-md space-y-2">
        <p className="text-sm font-semibold text-gray-700">پورت: <span className="font-mono text-indigo-700">{routeNode.port_address}</span></p>
        <div className="text-sm font-semibold text-gray-700 flex items-center justify-between">
            <span>سیم ۱:</span>
            <ColorDisplay
              value={color1Def?.value || ''}
              name={wire_1_color_name || 'نامشخص'}
            />
        </div>
        <div className="text-sm font-semibold text-gray-700 flex items-center justify-between">
            <span>سیم ۲:</span>
            <ColorDisplay
              value={color2Def?.value || ''}
              name={wire_2_color_name || 'نامشخص'}
            />
        </div>
      </div>
    </div>
  );
};

const WireConnector: React.FC = () => {
    return (
        <div className="flex items-center justify-center text-gray-400 my-1 md:my-0 md:mx-2">
            {/* Mobile Arrow (Down) */}
            <svg className="w-6 h-12 md:hidden" viewBox="0 0 24 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0V45" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M7 40L12 48L17 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            {/* Desktop Arrow (Left - for RTL) */}
            <svg className="hidden md:block w-20 h-8" viewBox="0 0 80 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M80 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M10 7L2 12L10 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </div>
    );
};

export const PhoneLineGraphView: React.FC = () => {
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const navigate = useNavigate();
  const { isLoading: isContextLoading } = useSupabaseContext();
  
  const [line, setLine] = useState<PhoneLine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLine = useCallback(async () => {
    if (!phoneNumber) return;
    setIsLoading(true);
    setError(null);
    try {
      const fetchedLine = await getPhoneLineByNumber(phoneNumber);
      if (fetchedLine) {
        setLine(fetchedLine);
      } else {
        setError(`خط تلفن با شماره "${phoneNumber}" یافت نشد.`);
      }
    } catch (err: any) {
      setError(`خطا در بارگذاری مسیر خط: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber]);

  useEffect(() => {
    if (!isContextLoading) {
      fetchLine();
    }
  }, [fetchLine, isContextLoading]);

  if (isLoading || isContextLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-4 bg-red-100 rounded-lg text-center">{error}</div>;
  }

  if (!line) {
    return <div className="text-center p-4">اطلاعات خط یافت نشد.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 border-b pb-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-900">مسیر خط تلفن: <span className="font-mono text-indigo-700">{line.phone_number}</span></h2>
            <p className="text-gray-600 mt-1">مصرف کننده/واحد: {line.consumer_unit || 'نامشخص'}</p>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse mt-4 sm:mt-0">
            <Button variant="primary" onClick={() => navigate(`/phone-lines/edit/${line.id}`)}>
                <EditIcon className="ml-2" />
                ویرایش مسیر
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/phone-lines/new?copyFrom=${line.id}`)}>
                <CopyIcon className="ml-2" />
                کپی مسیر
            </Button>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg overflow-x-auto custom-scrollbar flex justify-center md:block">
        {line.route_nodes && line.route_nodes.length > 0 ? (
          <div className="flex flex-col md:flex-row items-center py-4 md:py-8 md:min-w-max">
            {line.route_nodes.map((routeNode, index) => (
              <React.Fragment key={routeNode.id}>
                <NodeCard routeNode={routeNode} />
                {index < line.route_nodes!.length - 1 && <WireConnector />}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <p>هیچ مسیری برای این خط تلفن ثبت نشده است.</p>
          </div>
        )}
      </div>
    </div>
  );
};
