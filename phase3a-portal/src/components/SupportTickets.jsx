/**
 * Support Tickets Component
 * Create, view, and manage support tickets with commenting and attachments
 */

import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Plus,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Paperclip,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Send,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { formatDate, formatRelativeTime } from '../utils/formatters';

export const SupportTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [expandedTickets, setExpandedTickets] = useState({});

  // Create form state
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    category: 'general',
    attachments: [],
  });

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, priorityFilter]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;

      const response = await apiService.getSupportTickets(params);
      setTickets(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      const response = await apiService.createSupportTicket(newTicket);
      setTickets([response.data, ...tickets]);
      setNewTicket({
        subject: '',
        description: '',
        priority: 'medium',
        category: 'general',
        attachments: [],
      });
      setShowCreateForm(false);
      setError(null);
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setError(err.message || 'Failed to create ticket');
    }
  };

  const handleAddComment = async (ticketId) => {
    if (!commentText.trim()) return;

    try {
      setSubmittingComment(true);
      await apiService.addTicketComment(ticketId, commentText);
      
      // Reload ticket details
      const response = await apiService.getSupportTickets();
      const updated = response.data.find((t) => t.id === ticketId);
      setSelectedTicket(updated);
      
      setCommentText('');
      setError(null);
    } catch (err) {
      console.error('Failed to add comment:', err);
      setError(err.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      await apiService.updateSupportTicket(ticketId, { status: newStatus });
      const updated = tickets.map((t) =>
        t.id === ticketId ? { ...t, status: newStatus } : t
      );
      setTickets(updated);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (err) {
      console.error('Failed to update ticket:', err);
      setError(err.message || 'Failed to update ticket');
    }
  };

  const toggleTicketExpand = (ticketId) => {
    setExpandedTickets((prev) => ({
      ...prev,
      [ticketId]: !prev[ticketId],
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setNewTicket((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...files],
    }));
  };

  const filteredTickets = tickets.filter((ticket) =>
    ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.id.toString().includes(searchTerm)
  );

  const getPriorityIcon = (priority) => {
    if (priority === 'critical') return <AlertCircle className="w-5 h-5 text-red-600" />;
    if (priority === 'high') return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    if (priority === 'medium') return <Clock className="w-5 h-5 text-yellow-600" />;
    return <CheckCircle2 className="w-5 h-5 text-blue-600" />;
  };

  const getPriorityBadgeColor = (priority) => {
    if (priority === 'critical') return 'bg-red-100 text-red-800';
    if (priority === 'high') return 'bg-orange-100 text-orange-800';
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getStatusBadgeColor = (status) => {
    if (status === 'open') return 'bg-blue-100 text-blue-800';
    if (status === 'in-progress') return 'bg-yellow-100 text-yellow-800';
    if (status === 'waiting-customer') return 'bg-gray-100 text-gray-800';
    if (status === 'resolved') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
              <p className="text-gray-600 mt-1">
                Get help from our support team
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Ticket
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-8 bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Ticket</h2>
            <form onSubmit={handleCreateTicket}>
              <div className="grid grid-cols-1 gap-4 mb-4">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={newTicket.subject}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, subject: e.target.value })
                    }
                    placeholder="Brief description of your issue"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={newTicket.description}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, description: e.target.value })
                    }
                    placeholder="Detailed description of your issue"
                    required
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Priority & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={newTicket.priority}
                      onChange={(e) =>
                        setNewTicket({ ...newTicket, priority: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={newTicket.category}
                      onChange={(e) =>
                        setNewTicket({ ...newTicket, category: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="general">General</option>
                      <option value="billing">Billing</option>
                      <option value="technical">Technical</option>
                      <option value="feature-request">Feature Request</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attachments
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Paperclip className="w-5 h-5 mr-2 text-gray-600" />
                      <span className="text-sm text-gray-700">Choose files</span>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {newTicket.attachments.length > 0 && (
                      <div className="text-sm text-gray-600">
                        {newTicket.attachments.length} file(s) selected
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Create Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Ticket ID or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setExpandedTickets({});
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Tickets</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="waiting-customer">Waiting for Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setExpandedTickets({});
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading tickets...</p>
              </div>
            </div>
          ) : filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition"
              >
                <button
                  onClick={() => toggleTicketExpand(ticket.id)}
                  className="w-full px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-start flex-1 gap-4">
                    <div className="mt-1">{getPriorityIcon(ticket.priority)}</div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-gray-900">{ticket.subject}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          #{ticket.id}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium ${getPriorityBadgeColor(
                            ticket.priority
                          )}`}
                        >
                          {ticket.priority.charAt(0).toUpperCase() +
                            ticket.priority.slice(1)}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium ${getStatusBadgeColor(
                            ticket.status
                          )}`}
                        >
                          {ticket.status
                            .replace('-', ' ')
                            .split(' ')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        Created {formatRelativeTime(ticket.created_at)}
                      </p>
                    </div>
                  </div>
                  {expandedTickets[ticket.id] ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded Details */}
                {expandedTickets[ticket.id] && (
                  <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {ticket.description}
                      </p>
                    </div>

                    {/* Status Update */}
                    <div className="mb-6 flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-700">
                        Change Status:
                      </span>
                      <select
                        value={ticket.status}
                        onChange={(e) =>
                          handleUpdateStatus(ticket.id, e.target.value)
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="waiting-customer">Waiting for Customer</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    {/* Comments Section */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Comments ({ticket.comments?.length || 0})
                      </h4>

                      {/* Comments List */}
                      <div className="bg-white rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
                        {ticket.comments && ticket.comments.length > 0 ? (
                          <div className="space-y-4">
                            {ticket.comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="border-b border-gray-200 pb-4 last:border-b-0"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <p className="font-medium text-gray-900 flex items-center">
                                    <User className="w-4 h-4 mr-2 text-gray-600" />
                                    {comment.author}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {formatRelativeTime(comment.created_at)}
                                  </p>
                                </div>
                                <p className="text-sm text-gray-700">
                                  {comment.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 text-center py-8">
                            No comments yet
                          </p>
                        )}
                      </div>

                      {/* Add Comment */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(ticket.id);
                            }
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <button
                          onClick={() => handleAddComment(ticket.id)}
                          disabled={!commentText.trim() || submittingComment}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          {submittingComment ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-64 bg-white rounded-lg">
              <div className="text-center">
                <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4 opacity-20" />
                <p className="text-gray-600 font-medium">No tickets found</p>
                <p className="text-gray-500 text-sm mt-1">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : 'Create your first support ticket'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Support Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">Support Guidelines</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>
              • <strong>Response Time:</strong> Critical issues (1 hour), High (4 hours),
              Medium (24 hours), Low (48 hours)
            </li>
            <li>
              • <strong>Business Hours:</strong> Support available Mon-Fri, 9am-6pm UTC
            </li>
            <li>
              • <strong>Emergency:</strong> Contact us at emergency@securebase.dev for
              critical issues
            </li>
            <li>
              • <strong>Documentation:</strong> Check our{' '}
              <a href="/docs" className="underline font-medium">
                docs
              </a>{' '}
              for common questions
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SupportTickets;
