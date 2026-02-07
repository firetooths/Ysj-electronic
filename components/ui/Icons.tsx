
import React from 'react';

interface IconProps {
  className?: string;
  [key: string]: any; // Allow other props like 'title'
}

const FaIcon: React.FC<IconProps & { iconClass: string }> = ({ iconClass, className, ...props }) => (
  <i className={`${iconClass} ${className || ''}`} {...props}></i>
);

export const EditIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-pencil-alt" {...props} />;
export const DeleteIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-trash-alt" {...props} />;
export const AddIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-plus" {...props} />;
export const DetailsIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-info-circle" {...props} />;
export const CameraIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-camera" {...props} />;
export const FileUploadIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-upload" {...props} />;
export const DashboardIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-tachometer-alt" {...props} />;
export const AssetIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-box" {...props} />;
export const CategoryIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-tags" {...props} />;
export const LocationIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-map-marker-alt" {...props} />;
export const BulkImportIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-file-import" {...props} />;
export const ExportIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-file-export" {...props} />;
export const CloseIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-times" {...props} />;
export const CheckIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-check" {...props} />;
export const WarningIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-exclamation-triangle" {...props} />;
export const InfoIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-info-circle" {...props} />;
export const SettingsIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-cog" {...props} />;
export const TransferIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-right-from-bracket" {...props} />;
export const TransferredListIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-people-arrows" {...props} />;
export const HomeIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-home" {...props} />;
export const PhoneIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-phone" {...props} />;
export const RouteIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-route" {...props} />;
export const NodeIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-sitemap" {...props} />;
export const LineIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-phone-alt" {...props} />;
export const ListIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-list-ul" {...props} />;
export const WrenchIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-wrench" {...props} />;
export const LogIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-history" {...props} />;
export const TagIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-tag" {...props} />;
export const CnsFaultIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-satellite-dish" {...props} />;
export const CopyIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-copy" {...props} />;
export const SearchIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-search" {...props} />;
export const BarChartIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-chart-bar" {...props} />;
export const PrintIcon: React.FC<IconProps> = (props) => <FaIcon iconClass="fas fa-print" {...props} />;
