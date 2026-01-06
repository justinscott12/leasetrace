'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, X, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface BulkUploadProps {
  onUpload: (documents: Array<{ name: string; text: string }>) => void
}

export default function BulkUpload({ onUpload }: BulkUploadProps) {
  const [files, setFiles] = useState<Array<{ name: string; text: string; status: 'pending' | 'processing' | 'complete' | 'error' }>>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return

    const newFiles: Array<{ name: string; text: string; status: 'pending' }> = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
        toast.error(`${file.name} is not a text file. Only .txt files are supported.`)
        continue
      }

      try {
        const text = await file.text()
        newFiles.push({
          name: file.name,
          text: text,
          status: 'pending'
        })
      } catch (error) {
        toast.error(`Failed to read ${file.name}`)
      }
    }

    setFiles(prev => [...prev, ...newFiles])
    toast.success(`Added ${newFiles.length} lease${newFiles.length > 1 ? 's' : ''}`)
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleBulkUpload = async () => {
    if (files.length === 0) {
      toast.error('Please add at least one lease file')
      return
    }

    setIsProcessing(true)
    try {
      // Process files one by one (to avoid rate limits)
      const documents = files.map(f => ({ name: f.name, text: f.text }))
      await onUpload(documents)
      toast.success(`Processing ${files.length} lease${files.length > 1 ? 's' : ''}...`)
      setFiles([])
    } catch (error) {
      toast.error('Failed to start bulk audit')
      console.error('Bulk upload error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6" data-agent-id="bulk-upload-component">
      <div>
        <h2 className="text-2xl font-bold mb-2 gradient-text" data-agent-id="bulk-upload-title">
          Bulk Lease Compliance Check
        </h2>
        <p className="text-gray-600" data-agent-id="bulk-upload-description">
          Upload multiple commercial lease agreements to check compliance. Perfect for property managers with multiple properties.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <input
            type="file"
            multiple
            accept=".txt"
            onChange={handleFileSelect}
            className="hidden"
            id="bulk-file-input"
            data-agent-id="bulk-file-input"
          />
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium mb-2">
              Click to select lease files (.txt)
            </p>
            <p className="text-sm text-gray-500">
              Select multiple files to upload
            </p>
          </motion.div>
        </label>

        {files.length > 0 && (
          <div className="space-y-2" data-agent-id="bulk-file-list">
            <h3 className="text-sm font-medium text-gray-700">
              Selected Leases ({files.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  data-agent-id={`bulk-file-item-${index}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-primary-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.text.length / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    data-agent-id={`remove-file-${index}`}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleBulkUpload}
          disabled={isProcessing || files.length === 0}
          className="btn-primary w-full"
          data-agent-id="bulk-upload-submit-button"
        >
          {isProcessing ? (
            <>Processing {files.length} lease{files.length > 1 ? 's' : ''}...</>
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              Check {files.length > 0 ? `${files.length} ` : ''}Lease{files.length > 1 ? 's' : ''} Compliance
            </>
          )}
        </motion.button>
      </div>
    </div>
  )
}

