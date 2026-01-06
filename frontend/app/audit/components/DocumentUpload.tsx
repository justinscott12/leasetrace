'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface DocumentUploadProps {
  onUpload: (documentText: string) => void
}

export default function DocumentUpload({ onUpload }: DocumentUploadProps) {
  const [documentText, setDocumentText] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const handleSubmit = async () => {
    if (!documentText.trim()) {
      toast.error('Please enter document text')
      return
    }

    setIsUploading(true)
    try {
      await onUpload(documentText)
      toast.success('Audit started')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start audit'
      toast.error(errorMessage)
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6" data-agent-id="document-upload-component">
      <div>
        <h2 className="text-2xl font-bold mb-2 gradient-text" data-agent-id="upload-title">
          Commercial Lease Compliance Check
        </h2>
        <p className="text-gray-600" data-agent-id="upload-description">
          Upload or paste your commercial lease agreement to check compliance with Florida landlord-tenant laws (Chapter 83). Get actionable recommendations to protect your property and avoid costly violations.
        </p>
      </div>

      <div className="space-y-4">
        <label htmlFor="document-text" className="block text-sm font-medium text-gray-700" data-agent-id="upload-label">
          Document Text
        </label>
        <textarea
          id="document-text"
          data-agent-id="document-text-input"
          className="input-field min-h-[300px] p-4"
          placeholder="Paste your commercial lease agreement here... (Florida Chapter 83 compliance check)"
          value={documentText}
          onChange={(e) => setDocumentText(e.target.value)}
        />
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSubmit}
        disabled={isUploading || !documentText.trim()}
        className="btn-primary w-full"
        data-agent-id="upload-submit-button"
      >
        {isUploading ? (
          <>Processing...</>
        ) : (
          <>
            <FileText className="w-5 h-5 mr-2" />
            Check Lease Compliance
          </>
        )}
      </motion.button>
    </div>
  )
}

